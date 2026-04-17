import re
import joblib
from typing import Dict


FEE_PATTERNS = [
    r"\bregistration\s+fee\b",
    r"\bpay\s+(?:rs\.?|inr|₹)?\s*\d+",
    r"\bsecurity\s+deposit\b",
    r"\bprocessing\s+fee\b",
    r"\bpay\s+before\s+joining\b",
    r"\bapplication\s+fee\b",
    r"\bfee\s+required\b",
]
SALARY_RANGES = {
    "default": (200000, 1500000)
}
model = joblib.load("models/scam_classifier.pkl")


def check_fee_language(offer_text: str) -> Dict:
    text = offer_text.lower()
    matches = sum(1 for pattern in FEE_PATTERNS if re.search(pattern, text, re.IGNORECASE))

    return {
        "flag": matches >= 1,
        "matches": matches,
        "penalty": 30 + (matches * 5),
        "reason": f"{matches} payment-related scam indicators detected." if matches else "No fee language detected.",
        "hard_cap": matches >= 2,
    }


def check_salary_anomaly(salary: float) -> Dict:
    if salary == 0:
        return {
            "flag": False,
            "penalty": 0,
            "reason": "No salary provided",
        }

    _, max_salary = SALARY_RANGES["default"]

    if salary > max_salary:
        return {
            "flag": True,
            "penalty": 25,
            "reason": "Salary unusually high for role",
        }

    return {
        "flag": False,
        "penalty": 0,
        "reason": "Salary within expected range",
    }


def check_nlp_classifier(offer_text: str) -> Dict:
    probability = model.predict_proba([offer_text])[0][1]

    if probability >= 0.55:
        return {
            "flag": True,
            "confidence": float(probability),
            "penalty": 20,
            "reason": "Text classified as scam-like",
        }

    return {
        "flag": False,
        "confidence": probability,
        "penalty": 0,
        "reason": "Text appears legitimate",
    }


def run_ml_checks(offer_text: str, salary: float = 0, company: str = "") -> Dict:
    """
    Placeholder ML checks pipeline.
    Will combine fee detection, salary anomaly, and NLP classifier.
    """
    fee_result = check_fee_language(offer_text)
    salary_result = check_salary_anomaly(salary)
    nlp_result = check_nlp_classifier(offer_text)

    total_penalty = (
        fee_result["penalty"] +
        salary_result["penalty"] +
        nlp_result["penalty"]
    )

    if fee_result["hard_cap"]:
        trust_score = max(0, 30 - total_penalty)
    else:
        trust_score = max(0, 100 - total_penalty)

    if trust_score >= 70:
        verdict = "VERIFIED"
    elif trust_score >= 40:
        verdict = "SUSPICIOUS"
    else:
        verdict = "SCAM"

    reasons = []

    if fee_result["flag"]:
        reasons.append(fee_result["reason"])

    if salary_result["flag"]:
        reasons.append(salary_result["reason"])

    if nlp_result["flag"]:
        reasons.append(nlp_result["reason"])

    return {
        "trust_score": trust_score,
        "verdict": verdict,
        "reasons": reasons,
        "details": {
            "fee": fee_result,
            "salary": salary_result,
            "nlp": nlp_result,
        },
    }