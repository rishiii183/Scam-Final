from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3, json, uuid

# Import the advanced analysis functions
from checks.cyber import analyze as run_cyber_analyze
from checks.ml import run_ml_checks

# 1. Initialize the App
app = FastAPI()

# 2. Allow the frontend to talk to the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# 3. Define the Data Contract
# Added defaults to prevent 422 errors when tabs only send partial data
class CheckRequest(BaseModel):
    job_url: str = "N/A"
    company_claimed: str = "Unknown"
    recruiter_email: str = ""
    salary_offered: float = 0
    offer_text: str = ""

# 4. Advanced Scoring Logic
def score(cyber_report: dict, ml: dict):
    # Start with the core score from the Advanced Cyber Engine
    base_points = cyber_report.get("overall_score", 100)
    reasons = cyber_report.get("reasons", [])
    
    # Define the "Trust Shield"
    is_highly_trusted = (
        cyber_report.get("confidence", 0) > 0.85 and 
        cyber_report.get("verdict") == "SAFE"
    )

    ml_penalty = 0
    # Process ML signals from the NLP layer
    for name, result in ml.get("details", {}).items():
        if isinstance(result, dict) and result.get("flag"):
            # If highly trusted, ignore soft signals but NEVER ignore fee language
            if is_highly_trusted and name != "fee_language":
                continue 
                
            ml_penalty += result.get("penalty", 0)
            reasons.append(result.get("reason", name))

    # Final Calculation
    final_score = max(0, base_points - ml_penalty)
    
    # Determine the final UI verdict
    if final_score >= 80: verdict = "VERIFIED"
    elif final_score >= 55: verdict = "UNVERIFIED"
    elif final_score >= 30: verdict = "SUSPICIOUS"
    else: verdict = "SCAM"
        
    return int(final_score), verdict, reasons

# 5. Database Setup (SQLite)
def init_db():
    con = sqlite3.connect("scamshield.db")
    con.execute(
        "CREATE TABLE IF NOT EXISTS checks ("
        "id TEXT PRIMARY KEY, url TEXT, "
        "score INTEGER, verdict TEXT, "
        "signals TEXT, ts DATETIME DEFAULT CURRENT_TIMESTAMP)"
    )
    con.commit()
    con.close()

@app.on_event("startup")
def startup():
    init_db()

# 6. The API Endpoint
@app.post("/api/check")
def check(req: CheckRequest):
    # A. Run Advanced Cyber Analysis
    cyber_input = {
        "job_url": req.job_url,
        "company_claimed": req.company_claimed,
        "recruiter_email": req.recruiter_email,
        "salary_offered": req.salary_offered,
        "offer_text": req.offer_text
    }
    cyber_report = run_cyber_analyze(cyber_input)
    
    # B. Run ML Checks
    ml_report = run_ml_checks(req.offer_text, req.salary_offered, req.company_claimed)
    
    # C. Final Fusion Scoring
    trust_score, verdict, reasons = score(cyber_report, ml_report)
    
    # D. Forensic Packaging
    rid = str(uuid.uuid4())[:8]
    combined_signals = {
        "cyber_signals": cyber_report.get("signals", []),
        "ml_details": ml_report.get("details", {})
    }
    
    # Log to Database
    con = sqlite3.connect("scamshield.db")
    con.execute("INSERT INTO checks VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)",
                (rid, req.job_url, trust_score, verdict, json.dumps(combined_signals)))
    con.commit()
    con.close()
    
    return {
        "request_id": rid,
        "trust_score": trust_score,
        "verdict": verdict,
        "reasons": reasons,
        "summary": cyber_report.get("summary", ""),
        "recommendations": cyber_report.get("recommendations", []),
        "signals": combined_signals
    }

@app.get("/api/stats")
def stats():
    con = sqlite3.connect("scamshield.db")
    r = con.execute("SELECT COUNT(*), SUM(CASE WHEN verdict='SCAM' THEN 1 ELSE 0 END) FROM checks").fetchone()
    con.close()
    return {"total_checks": r[0], "scams_caught": r[1] or 0}