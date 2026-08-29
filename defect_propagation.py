"""
ReleaseSentinel — Defect Propagation Machine Learning Graph Model
Module: defect_propagation.py
Architecture: Directed Acyclic Graph (DAG) Network Analysis (NetworkX)
"""

import networkx as nx
from typing import Dict, List, Any, Set

class DefectPropagationGraph:
    def __init__(self):
        self.graph = nx.DiGraph()
        self._build_default_architecture_graph()

    def _build_default_architecture_graph(self):
        """Constructs production microservices dependency topology."""
        # Nodes with base criticality and user exposure weight
        services = {
            "payment-service": {"criticality": 0.95, "users": 150000},
            "auth-service": {"criticality": 0.98, "users": 200000},
            "order-service": {"criticality": 0.85, "users": 120000},
            "checkout-service": {"criticality": 0.90, "users": 140000},
            "inventory-service": {"criticality": 0.70, "users": 60000},
            "notification-service": {"criticality": 0.40, "users": 80000},
            "analytics-service": {"criticality": 0.30, "users": 25000},
            "api-gateway": {"criticality": 0.99, "users": 250000}
        }

        for s, attr in services.items():
            self.graph.add_node(s, **attr)

        # Edges: dependency flow (A depends on B)
        dependencies = [
            ("api-gateway", "auth-service", 0.95),
            ("api-gateway", "checkout-service", 0.90),
            ("api-gateway", "order-service", 0.85),
            ("checkout-service", "payment-service", 0.98),
            ("checkout-service", "inventory-service", 0.75),
            ("order-service", "payment-service", 0.92),
            ("order-service", "inventory-service", 0.70),
            ("payment-service", "notification-service", 0.35),
            ("order-service", "notification-service", 0.30),
            ("notification-service", "analytics-service", 0.15),
            ("payment-service", "analytics-service", 0.20)
        ]

        for u, v, weight in dependencies:
            self.graph.add_edge(u, v, propagation_prob=weight)

    def analyze_blast_radius(self, changed_modules: List[str]) -> Dict[str, Any]:
        """
        Calculates the downstream defect propagation, affected services,
        and maximum user exposure if defects escape in the changed modules.
        """
        affected_services: Set[str] = set()
        propagation_paths: List[List[str]] = []
        total_exposed_users = 0
        criticality_sum = 0.0

        for module in changed_modules:
            if module in self.graph:
                affected_services.add(module)
                # Find all downstream reachable nodes
                descendants = nx.descendants(self.graph, module)
                affected_services.update(descendants)

                # Find all ancestors (upstream callers affected by failure)
                ancestors = nx.ancestors(self.graph, module)
                affected_services.update(ancestors)

                for desc in descendants:
                    try:
                        paths = list(nx.all_simple_paths(self.graph, module, desc, cutoff=4))
                        propagation_paths.extend(paths[:3])
                    except nx.NetworkXNoPath:
                        continue

        for svc in affected_services:
            node_data = self.graph.nodes.get(svc, {})
            total_exposed_users += node_data.get("users", 10000)
            criticality_sum += node_data.get("criticality", 0.5)

        avg_criticality = round(criticality_sum / max(len(affected_services), 1), 3)
        blast_radius_pct = round((len(affected_services) / max(len(self.graph.nodes), 1)) * 100, 1)

        return {
            "origin_changed_modules": changed_modules,
            "total_impacted_services": len(affected_services),
            "blast_radius_percentage": blast_radius_pct,
            "affected_service_list": sorted(list(affected_services)),
            "estimated_user_exposure": total_exposed_users,
            "mean_criticality_index": avg_criticality,
            "sample_propagation_chains": propagation_paths[:5]
        }

if __name__ == "__main__":
    print("=== ReleaseSentinel: Testing Defect Propagation Graph ===")
    graph_engine = DefectPropagationGraph()
    changed = ["payment-service", "order-service"]

    res = graph_engine.analyze_blast_radius(changed)
    print(f"Origin Modules: {res['origin_changed_modules']}")
    print(f"Blast Radius: {res['blast_radius_percentage']}% ({res['total_impacted_services']} services)")
    print(f"Affected Services: {', '.join(res['affected_service_list'])}")
    print(f"Estimated User Exposure: {res['estimated_user_exposure']:,} users")
    print(f"Mean Criticality: {res['mean_criticality_index']}")
    print("\nSample Propagation Chains:")
    for path in res["sample_propagation_chains"]:
        print(f" -> {' -> '.join(path)}")
