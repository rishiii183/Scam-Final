import re
import joblib
from typing import Dict

FEE_PATTERNS = [
    r"\bregistration\s+fee\b",
    r"\bpay\s+(?:rs\.?|inr|₹|\$|usd)?\s*\d+",
    r"\bsecurity\s+deposit\b",
    r"\bprocessing\s+fee\b",
    r"\bpay\s+before\s+joining\b",
    r"\bapplication\s+fee\b",
    r"\bfee\s+required\b",
    r"\brefundable\s+deposit\b",
    r"\bwestern\s+union\b",
    r"\bwire\s+transfer\b",
    r"\bcrypto\s*(?:currency|wallet|bitcoin)?\b",
    r"\bbitcoin\s+wallet\b",
    r"\bsend\s+money\b",
    r"\btransfer\s+(?:the\s+)?(?:fee|amount|funds)\b",
]

URGENCY_PATTERNS = [
    r"\b(?:expires?\s+in|within)\s+\d+\s+hours?\b",
    r"\blimited\s+(?:time|seats?|positions?)\b",
    r"\bdo\s+not\s+(?:contact|call|visit)\b",
    r"\bonly\s+(?:whatsapp|telegram|gmail|yahoo)\b",
    r"\bimmediately\b",
    r"\burgent(?:ly)?\b",
    r"\bfinal\s+(?:notice|offer|warning)\b",
]

TRUST_PATTERNS = [
    r"\blinkedin\.com\b",
    r"\bofficial\s+(?:website|portal|channel)\b",
    r"\bverified\s+employer\b",
    r"\bbackground\s+check\b",
    r"\bhr\s+department\b",
]

# Salary ranges in USD/month — covers both INR and USD inputs
# INR annual: 200k–1.5M → monthly: ~1,667–12,500 USD equivalent
# USD monthly reasonable ranges by role type
SALARY_THRESHOLDS = {
    "data_entry":       (500,   4000),
    "customer_support": (800,   5000),
    "software":         (3000,  25000),
    "manager":          (4000,  30000),
    "default":          (500,   15000),
}

# Keywords to detect role type from offer text
ROLE_KEYWORDS = {
    "data_entry":       ["data entry", "typing", "form fill"],
    "customer_support": ["customer support", "customer service", "call center", "bpo"],
    "software":         ["software", "developer", "engineer", "coding", "programmer"],
    "manager":          ["manager", "director", "head of", "vp ", "vice president"],
}

model = joblib.load("models/scam_classifier.pkl")


def detect_role_type(text: str, company: str = "") -> str:
    combined = (text + " " + company).lower()
    for role, keywords in ROLE_KEYWORDS.items():
        if any(k in combined for k in keywords):
            return role
    return "default"


def check_fee_language(offer_text: str) -> Dict:
    text = offer_text.lower()
    fee_matches = sum(1 for p in FEE_PATTERNS if re.search(p, text, re.IGNORECASE))
    urgency_matches = sum(1 for p in URGENCY_PATTERNS if re.search(p, text, re.IGNORECASE))
    trust_matches = sum(1 for p in TRUST_PATTERNS if re.search(p, text, re.IGNORECASE))

    # Trust signals reduce penalty
    trust_reduction = min(trust_matches * 5, 15)
    raw_penalty = 30 + (fee_matches * 8) + (urgency_matches * 6) - trust_reduction
    final_penalty = max(0, raw_penalty)

    total_red_flags = fee_matches + urgency_matches
    is_flagged = total_red_flags >= 1

    if total_red_flags == 0:
        reason = "No fee or urgency language detected."
    elif fee_matches > 0 and urgency_matches > 0:
        reason = f"{fee_matches} payment demand(s) and {urgency_matches} urgency signal(s) detected."
    elif fee_matches > 0:
        reason = f"{fee_matches} payment-related scam indicator(s) detected."
    else:
        reason = f"{urgency_matches} urgency/pressure tactic(s) detected."

    return {
        "flag": is_flagged,
        "fee_matches": fee_matches,
        "urgency_matches": urgency_matches,
        "trust_matches": trust_matches,
        "penalty": final_penalty,
        "reason": reason,
        "hard_cap": fee_matches >= 2,
    }


def check_salary_anomaly(salary: float, offer_text: str = "", company: str = "") -> Dict:
    if salary <= 0:
        return {
            "flag": False,
            "penalty": 0,
            "reason": "No salary provided for analysis.",
        }

    role = detect_role_type(offer_text, company)
    min_sal, max_sal = SALARY_THRESHOLDS[role]

    # Handle INR annual input (large numbers like 500000)
    # Convert to approximate USD monthly for comparison
    if salary > 50000:
        # Likely INR annual — convert: divide by 12 months, divide by ~83 exchange rate
        salary_usd_monthly = salary / 12 / 83
    else:
        salary_usd_monthly = salary

    if salary_usd_monthly > max_sal * 2:
        return {
            "flag": True,
            "penalty": 35,
            "reason": f"Salary is {round(salary_usd_monthly / max_sal, 1)}x above market rate for this role type — major red flag.",
        }
    elif salary_usd_monthly > max_sal:
        return {
            "flag": True,
            "penalty": 20,
            "reason": f"Salary is above typical market range for {role.replace('_', ' ')} roles.",
        }
    elif salary_usd_monthly < min_sal * 0.5:
        return {
            "flag": True,
            "penalty": 10,
            "reason": f"Salary is unusually low — possible bait-and-switch tactic.",
        }

    return {
        "flag": False,
        "penalty": 0,
        "reason": f"Salary is within expected range for {role.replace('_', ' ')} roles.",
    }


def check_nlp_classifier(offer_text: str) -> Dict:
    # If text is too short/synthetic, skip NLP to avoid false signals
    word_count = len(offer_text.split())
    if word_count < 10:
        return {
            "flag": False,
            "confidence": 0.0,
            "penalty": 0,
            "reason": "Insufficient text for NLP analysis.",
        }

    try:
        probability = model.predict_proba([offer_text])[0][1]
    except Exception:
        return {
            "flag": False,
            "confidence": 0.0,
            "penalty": 0,
            "reason": "NLP model unavailable.",
        }

    if probability >= 0.75:
        return {
            "flag": True,
            "confidence": float(probability),
            "penalty": 25,
            "reason": f"NLP classifier: high scam probability ({round(probability * 100)}%).",
        }
    elif probability >= 0.55:
        return {
            "flag": True,
            "confidence": float(probability),
            "penalty": 12,
            "reason": f"NLP classifier: moderate scam signals ({round(probability * 100)}%).",
        }

    return {
        "flag": False,
        "confidence": float(probability),
        "penalty": 0,
        "reason": f"NLP classifier: text appears legitimate ({round((1 - probability) * 100)}% clean).",
    }


def check_company_signals(company: str) -> Dict:
    """Extra check for company name red flags."""
    if not company or company in ("Unknown", "Unknown Role", ""):
        return {"flag": False, "penalty": 0, "reason": "No company name provided."}

    text = company.lower()

    red_flags = [
        ("global recruitment", 15, "Generic 'global recruitment' company name pattern."),
        ("work from home", 10, "Company name includes 'work from home' — unusual for legitimate firms."),
        ("remote jobs", 10, "Company name includes 'remote jobs' — suspicious naming pattern."),
        ("pvt ltd", 0, None),   # neutral
        ("international", 8, "Vague 'international' suffix — common in fake company names."),
        ("services", 0, None),  # neutral
    ]

    total_penalty = 0
    reasons = []

    for keyword, penalty, reason in red_flags:
        if keyword in text and penalty > 0:
            total_penalty += penalty
            reasons.append(reason)

    # Check for suspiciously long names (fake companies often use verbose names)
    word_count = len(company.split())
    if word_count >= 5:
        total_penalty += 8
        reasons.append(f"Unusually long company name ({word_count} words) — common scam pattern.")

    is_flagged = total_penalty > 0
    return {
        "flag": is_flagged,
        "penalty": total_penalty,
        "reason": reasons[0] if reasons else "Company name appears normal.",
        "all_reasons": reasons,
    }


def run_ml_checks(offer_text: str, salary: float = 0, company: str = "") -> Dict:
    fee_result = check_fee_language(offer_text)
    salary_result = check_salary_anomaly(salary, offer_text, company)
    nlp_result = check_nlp_classifier(offer_text)
    company_result = check_company_signals(company)

    total_penalty = (
        fee_result["penalty"] +
        salary_result["penalty"] +
        nlp_result["penalty"] +
        company_result["penalty"]
    )

    if fee_result["hard_cap"]:
        base = 30
    else:
        base = 100

    trust_score = max(0, base - total_penalty)

    if trust_score >= 75:
        verdict = "VERIFIED"
    elif trust_score >= 50:
        verdict = "UNVERIFIED"
    elif trust_score >= 25:
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
    if company_result["flag"]:
        reasons.append(company_result["reason"])

    return {
        "trust_score": trust_score,
        "verdict": verdict,
        "reasons": reasons,
        "details": {
            "fee": fee_result,
            "salary": salary_result,
            "nlp": nlp_result,
            "company": company_result,
        },
    }