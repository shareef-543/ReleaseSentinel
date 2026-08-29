"""
ReleaseSentinel — Change Risk Machine Learning Model
Module: change_risk_model.py
Architecture: Logistic Regression + Random Forest Ensemble Classifier (Scikit-learn)
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from typing import Dict, Any, List

class ChangeRiskModel:
    def __init__(self):
        self.scaler = StandardScaler()
        self.lr_model = LogisticRegression(random_state=42)
        self.rf_model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=5)
        self.feature_names = [
            "test_coverage",
            "failed_tests",
            "flaky_tests",
            "changed_files",
            "changed_modules",
            "dependencies",
            "core_module_impact",
            "deployment_cadence"
        ]
        self._train_default_model()

    def _generate_synthetic_training_data(self, n_samples: int = 1200) -> pd.DataFrame:
        """Generates realistic historical CI/CD telemetry dataset for training."""
        np.random.seed(42)
        
        test_coverage = np.random.uniform(30, 100, n_samples)
        failed_tests = np.random.poisson(1.2, n_samples)
        flaky_tests = np.random.poisson(2.5, n_samples)
        changed_files = np.random.exponential(15, n_samples) + 1
        changed_modules = np.random.randint(1, 8, n_samples)
        dependencies = np.random.randint(0, 15, n_samples)
        core_impact = np.random.choice([0, 1], size=n_samples, p=[0.6, 0.4])
        deployment_cadence = np.random.randint(1, 11, n_samples)

        # Ground truth risk calculation
        risk_score = (
            (100 - test_coverage) * 0.35 +
            failed_tests * 12.0 +
            flaky_tests * 6.5 +
            changed_files * 0.5 +
            changed_modules * 5.0 +
            dependencies * 2.2 +
            core_impact * 20.0 -
            deployment_cadence * 1.5
        )

        labels = (risk_score > 50).astype(int)

        df = pd.DataFrame({
            "test_coverage": test_coverage,
            "failed_tests": failed_tests,
            "flaky_tests": flaky_tests,
            "changed_files": changed_files,
            "changed_modules": changed_modules,
            "dependencies": dependencies,
            "core_module_impact": core_impact,
            "deployment_cadence": deployment_cadence,
            "failed_release": labels
        })
        return df

    def _train_default_model(self):
        """Fits the ensemble models on synthetic historical data."""
        df = self._generate_synthetic_training_data()
        X = df[self.feature_names]
        y = df["failed_release"]

        X_scaled = self.scaler.fit_transform(X)
        self.lr_model.fit(X_scaled, y)
        self.rf_model.fit(X_scaled, y)

    def predict_risk(self, release_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Infers failure probability, decision gate, and SHAP-like feature attributions.
        """
        features = [
            float(release_data.get("test_coverage", 80)),
            float(release_data.get("failed_tests", 0)),
            float(release_data.get("flaky_tests", 0)),
            float(release_data.get("changed_files_count", 5)),
            float(release_data.get("changed_modules_count", 1)),
            float(release_data.get("dependencies_count", 2)),
            1.0 if release_data.get("core_module_impact", False) else 0.0,
            float(release_data.get("deployment_frequency_score", 7))
        ]

        X_input = np.array([features])
        X_scaled = self.scaler.transform(X_input)

        # Multi-model inference
        prob_lr = float(self.lr_model.predict_proba(X_scaled)[0][1])
        prob_rf = float(self.rf_model.predict_proba(X_scaled)[0][1])

        ensemble_prob = round((prob_rf * 0.6 + prob_lr * 0.4), 4)
        risk_score = round(ensemble_prob * 100, 1)

        # Decision classification
        if risk_score >= 70:
            decision = "HOLD"
            action = "MANDATORY BLOCK: High failure probability detected"
        elif risk_score >= 35:
            decision = "STAGED_RELEASE"
            action = "CANARY 5%: Deploy in stages with 15-min soak"
        else:
            decision = "RELEASE"
            action = "APPROVED: Direct continuous deployment"

        # Feature importances
        rf_importances = self.rf_model.feature_importances_
        feature_importance_map = {
            name: round(float(imp), 4)
            for name, imp in zip(self.feature_names, rf_importances)
        }

        return {
            "release_id": release_data.get("release_id", "REL-CURRENT"),
            "failure_probability": ensemble_prob,
            "risk_score": risk_score,
            "decision": decision,
            "recommended_action": action,
            "model_breakdown": {
                "random_forest_prob": round(prob_rf, 4),
                "logistic_regression_prob": round(prob_lr, 4)
            },
            "feature_importance_ranking": feature_importance_map
        }

if __name__ == "__main__":
    print("=== ReleaseSentinel: Testing Change Risk Model ===")
    model = ChangeRiskModel()
    
    test_release = {
        "release_id": "REL-2026-099",
        "test_coverage": 65,
        "failed_tests": 2,
        "flaky_tests": 5,
        "changed_files_count": 35,
        "changed_modules_count": 4,
        "dependencies_count": 8,
        "core_module_impact": True,
        "deployment_frequency_score": 5
    }

    result = model.predict_risk(test_release)
    print(f"Release: {result['release_id']}")
    print(f"Risk Score: {result['risk_score']}% | Probability: {result['failure_probability']}")
    print(f"Decision: {result['decision']} — {result['recommended_action']}")
    print("\nTop Feature Importances:")
    for feat, val in sorted(result["feature_importance_ranking"].items(), key=lambda x: x[1], reverse=True)[:4]:
        print(f" - {feat}: {val * 100:.1f}%")
