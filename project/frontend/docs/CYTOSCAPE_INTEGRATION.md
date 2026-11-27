# Cytoscape Integration and the NetworkX Graph Contract

> **Status: PROPOSED. Pending backend team agreement.**
> The Python below is an illustration for the backend team. It has not been run or tested, and
> nothing in this repository depends on it.

The frontend draws whatever `GET /api/v1/batches/{batchId}/custody-graph` returns. It knows nothing
about NetworkX: the backend owns analysis and flagging, the frontend owns layout and presentation.

## 1. Response shape

```json
{
  "batchId": "BAT-001",
  "nodes": [
    {
      "id": "ENT-INT-01",
      "label": "Quillon Trading Co.",
      "entityType": "intermediary",
      "flagged": true,
      "city": "Eastvale",
      "country": "XA",
      "licenseNumber": null,
      "licenseStatus": "unverified"
    }
  ],
  "edges": [
    {
      "id": "TXN-005",
      "source": "ENT-INT-01",
      "target": "ENT-PHA-02",
      "transactionType": "sale",
      "quantity": 4500,
      "occurredAt": "2026-09-19T07:00:00Z",
      "receivedAt": "2026-09-20T12:30:00Z",
      "documentReference": "DOC-005",
      "flagged": true,
      "flagReasons": ["quantity_exceeds_inventory", "unverified_party"]
    }
  ]
}
```

(The example is abbreviated: a real response also lists the node `ENT-PHA-02`.)

Field types and enum values are in [API_CONTRACTS.md](API_CONTRACTS.md#custody-graph).

- `entityType`: `manufacturer`, `warehouse`, `distributor`, `wholesaler`, `logistics_provider`,
  `pharmacy`, `hospital`, `intermediary`.
- Nullable metadata must be present with `null`, not omitted.
- No coordinates, colours or layout hints. Extra fields are ignored.

## 2. Rules the frontend enforces

A response that breaks any of these is **not drawn**; the user sees why instead.

| Rule | Reason |
| --- | --- |
| Matches the schema (types, enums, positive integer quantity, zoned timestamps) | Contract |
| Node ids are unique; edge ids are unique | An id must identify one record |
| Every `source` and `target` is a node in the same response | Dropping an edge would hide a movement |
| `flagReasons` is non-empty exactly when `flagged` is true | Every flag must be explainable |
| At most 300 nodes and 1,000 edges | Readability and layout time |

Several transactions between the same two entities are expected and are drawn separately.
An empty graph is valid (`"nodes": [], "edges": []`) and shows an empty state.

For larger batches, the backend would need to return a narrower slice (for example flagged
movements and their neighbourhood). No such query parameter is defined yet.

## 3. Suggested NetworkX conversion

Use `MultiDiGraph`: a plain `DiGraph` silently merges repeat transactions between two parties.
Use the transaction id as the edge key.

```python
import networkx as nx


def build_graph(entities: dict[str, dict], transactions: list[dict]) -> nx.MultiDiGraph:
    graph = nx.MultiDiGraph()
    for txn in transactions:
        for entity_id in (txn["source"], txn["target"]):
            graph.add_node(entity_id, **entities[entity_id])  # label, entityType, city, ...
        graph.add_edge(txn["source"], txn["target"], key=txn["id"], **txn["attributes"])
    return graph


def to_custody_graph(batch_id: str, graph: nx.MultiDiGraph) -> dict:
    flagged_entities = {
        node
        for source, target, data in graph.edges(data=True)
        if data["flagReasons"]
        for node in (source, target)
    }
    return {
        "batchId": batch_id,
        "nodes": [
            {**data, "id": node, "flagged": node in flagged_entities}
            for node, data in graph.nodes(data=True)
        ],
        "edges": [
            {**data, "id": key, "source": source, "target": target, "flagged": bool(data["flagReasons"])}
            for source, target, key, data in graph.edges(keys=True, data=True)
        ],
    }
```

Validate the result with Pydantic models that mirror section 1 (camelCase aliases) before returning
it. Do not return `networkx.node_link_data()` directly: its field names differ and it does not
include the rules above.

## 4. Wording and meaning of flags

`flagged` means "needs human review". The interface never presents it as confirmed fraud, and
backend text (labels, reasons) should follow the same rule. Confirmation happens only through the
human review endpoints.

## 5. Pydantic response models

Illustrative only; not run or tested.

```python
from typing import Literal
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


EntityType = Literal["manufacturer", "distributor", "wholesaler", "warehouse",
                     "logistics_provider", "pharmacy", "hospital", "intermediary"]
LicenseStatus = Literal["active", "suspended", "expired", "unverified"]
FlagReason = Literal["quantity_exceeds_inventory", "unverified_party", "missing_custody_record",
                     "timing_inconsistency", "expired_stock_movement", "missing_documentation"]


class GraphNode(Camel):
    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    entity_type: EntityType
    flagged: bool
    city: str | None
    country: str | None
    license_number: str | None
    license_status: LicenseStatus | None


class GraphEdge(Camel):
    id: str = Field(min_length=1)
    source: str
    target: str
    transaction_type: Literal["shipment", "sale", "transfer", "return"]
    quantity: int = Field(gt=0)
    occurred_at: AwareDatetime
    received_at: AwareDatetime | None
    document_reference: str | None
    flagged: bool
    flag_reasons: list[FlagReason]

    @model_validator(mode="after")
    def reasons_match_flag(self):
        if self.flagged != bool(self.flag_reasons):
            raise ValueError("flagReasons must be non-empty exactly when flagged")
        return self


class CustodyGraph(Camel):
    batch_id: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]
```

Serialise with `model_dump(by_alias=True, mode="json")`.

## 6. How the frontend draws it

- Layouts: hierarchical (`cytoscape-dagre`, left to right), circle, cose (nodes are spread afterwards
  so labels do not collide) and grid. Layouts receive one edge per pair of parties; every
  transaction is still drawn.
- One Cytoscape instance per mounted view; data, filters and selection update it in place.
- Selection is held by React and can be controlled by the host. Graph and inspector stay in step in
  both directions.

## 7. Frontend side

| File | Role |
| --- | --- |
| `src/components/graph/graph-adapter.ts` | Validation and conversion to Cytoscape elements. Change this if the agreed shape differs. |
| `src/components/graph/CustodyGraph.tsx` | Reusable component: `graph`, `isDemoData`, `defaultLayout`, `limits`, `showInspector`, `selection`, `onSelectionChange` |
| `src/components/graph/graph-controller.ts` | All Cytoscape calls |
| `src/features/explorer/BatchGraph.tsx` | Fetches through the typed API and renders the component |

```tsx
<CustodyGraph graph={response} isDemoData={false} />
```

New entity types or flag reasons need an update to `src/domain` and `graph-meta.ts`; until then a
response containing them is rejected.

To try the component with demo data: `npm run dev:mock`, then **Data Explorer → Batches**, open a batch and choose **Open custody graph**.
