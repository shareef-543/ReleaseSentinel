"""
ReleaseSentinel — NLP Incident Matcher
Module: incident_matcher.py
Architecture: TF-IDF Vector Space Embeddings + Cosine Similarity (Scikit-learn)
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Dict, Any

# Historical Outage Post-Mortem Knowledge Base
HISTORICAL_INCIDENTS = [
    {
        "incident_id": "INC-2025-081",
        "title": "Payment gateway timeout under concurrent traffic",
        "affected_module": "payment-service",
        "root_cause": "Unbounded connection pool exhaustion during database query lock",
        "failure_mode": "payment_timeout",
        "severity": "CRITICAL",
        "summary": "High concurrency checkout spike caused payment service connection pool exhaustion, leading to 504 timeouts across Stripe webhooks.",
        "resolution": "Configured connection pool max capacity and added circuit breaker."
    },
    {
        "incident_id": "INC-2025-044",
        "title": "JWT Token verification failure on expired signing key",
        "affected_module": "auth-service",
        "root_cause": "Improper key rotation logic in auth validation middleware",
        "failure_mode": "auth_failure",
        "severity": "CRITICAL",
        "summary": "New auth deployment pushed invalid RSA public key format, resulting in global 401 Unauthorized for active mobile app users.",
        "resolution": "Rolled back release and automated JWKS key rotation tests."
    },
    {
        "incident_id": "INC-2025-092",
        "title": "PostgreSQL schema migration deadlock",
        "affected_module": "order-service",
        "root_cause": "ALTER TABLE without lock timeout in high-write order transactions",
        "failure_mode": "db_migration_error",
        "severity": "HIGH",
        "summary": "Adding non-null column on orders table locked write transactions, halting order placement for 22 minutes.",
        "resolution": "Adopted zero-downtime expand-and-contract migration strategy."
    },
    {
        "incident_id": "INC-2025-115",
        "title": "Redis cache eviction cascade and memory leak",
        "affected_module": "inventory-service",
        "root_cause": "Uncapped in-memory cache accumulation without TTL policy",
        "failure_mode": "memory_leak",
        "severity": "HIGH",
        "summary": "Inventory lookup endpoint cached unbounded SKU objects, causing OOM killer crashes on Kubernetes nodes.",
        "resolution": "Enforced LRU eviction policy with 300s TTL."
    }
]

class IncidentMatcher:
    def __init__(self, incidents: List[Dict[str, Any]] = None):
        self.incidents = incidents or HISTORICAL_INCIDENTS
        self.vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        self._fit_corpus()

    def _fit_corpus(self):
        """Constructs and fits TF-IDF matrix on historical incident documents."""
        self.corpus = [
            f"{inc['title']} {inc['affected_module']} {inc['root_cause']} {inc['summary']} {inc['failure_mode']}"
            for inc in self.incidents
        ]
        self.tfidf_matrix = self.vectorizer.fit_transform(self.corpus)

    def match_release(self, query_text: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Finds the closest historical outage post-mortems matching the given release query.
        """
        query_vector = self.vectorizer.transform([query_text])
        similarities = cosine_similarity(query_vector, self.tfidf_matrix)[0]

        ranked_indices = similarities.argsort()[::-1][:top_k]
        results = []

        for idx in ranked_indices:
            score = float(similarities[idx])
            if score > 0.05:
                incident_data = self.incidents[idx].copy()
                incident_data["similarity_score"] = round(score * 100, 1)
                incident_data["confidence"] = "HIGH" if score > 0.4 else "MEDIUM" if score > 0.2 else "LOW"
                results.append(incident_data)

        return results

if __name__ == "__main__":
    print("=== ReleaseSentinel: Testing NLP Incident Matcher ===")
    matcher = IncidentMatcher()

    query = "payment-service timeout and database connection pool lock during checkout"
    print(f"Query: '{query}'\n")

    matches = matcher.match_release(query)
    for i, match in enumerate(matches, 1):
        print(f"[{i}] {match['incident_id']} — {match['title']}")
        print(f"    Similarity: {match['similarity_score']}% ({match['confidence']})")
        print(f"    Root Cause: {match['root_cause']}")
        print(f"    Resolution: {match['resolution']}\n")
