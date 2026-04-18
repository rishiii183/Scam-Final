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
        "penalty": 40 + (matches * 10) if matches else 0,
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
            "penalty": 30,
            "reason": "Salary unusually high for role",
        }

    return {
        "flag": False,
        "penalty": 0,
        "reason": "Salary within expected range",
    }


def check_nlp_classifier(offer_text: str) -> Dict:
    probability = model.predict_proba([offer_text])[0][1]

    if probability > 0.75:
        return {
            "flag": True,
            "confidence": float(probability),
            "penalty": 35,
            "reason": "Text classified as scam-like",
        }

    return {
        "flag": False,
        "confidence": probability,
        "penalty": 0,
        "reason": "Text appears legitimate",
    }


def apply_hard_caps(score: int, results: Dict) -> int:
    if results["fee"]["hard_cap"]:
        score = min(score, 20)

    if results["nlp"]["confidence"] > 0.8 and results["nlp"]["flag"]:
        score = min(score, 25)

    if results["fee"]["flag"] and results["salary"]["flag"]:
        score = min(score, 15)

    return score


def run_ml_checks(offer_text: str, salary: float = 0, company: str = "") -> Dict:
    """
    Placeholder ML checks pipeline.
    Will combine fee detection, salary anomaly, and NLP classifier.
    """
    fee_result = check_fee_language(offer_text)
    salary_result = check_salary_anomaly(salary)
    nlp_result = check_nlp_classifier(offer_text)
    results = {
        "fee": fee_result,
        "salary": salary_result,
        "nlp": nlp_result,
    }

    total_penalty = (
        fee_result["penalty"] +
        salary_result["penalty"] +
        nlp_result["penalty"]
    )

    score = 100 - total_penalty
    score = apply_hard_caps(score, results)
    score = max(score, 0)
    if not any([
        fee_result["flag"],
        salary_result["flag"],
        nlp_result["flag"]
    ]):
        score = max(score, 80)

    if score >= 70:
        verdict = "VERIFIED"
    elif score >= 40:
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
        "trust_score": score,
        "verdict": verdict,
        "reasons": reasons,
        "details": results,
    }