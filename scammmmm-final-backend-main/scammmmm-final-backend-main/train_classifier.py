from pathlib import Path
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

# --- CATEGORY 1: ADVANCED SCAM VECTORS ---
scam_texts = [
    # Payment & Processing Fees
    "Pay a registration fee before joining", "Send security deposit to confirm your job",
    "Processing fee required for offer letter", "Pay INR 5000 to start work from home",
    "Deposit money before training starts", "Pay Rs 3000 for document processing",
    "Refundable deposit required for laptop dispatch", "Application charge must be paid today",
    
    # Task-Based / Crypto Scams
    "Your task is to optimize 40 products daily to earn high commission in USDT",
    "Work 2 hours a day clicking buttons to increase app ratings and get paid instantly",
    "Join our Telegram group to receive daily tasks and earn 5000 INR per day",
    "Submit your crypto wallet address to receive your daily salary for app testing",
    "Like and subscribe to YouTube videos to earn quick cash rewards",
    
    # Phishing & Credential Theft
    "Your employee portal login has been compromised; please re-verify your bank details here",
    "Click this link to download your mandatory payroll software immediately",
    "To view your secret offer letter, enter your Gmail password on the linked portal",
    "Urgent: Update your PAN and Aadhaar on this external link to avoid offer cancellation",
    "Sync your bank account to our new HR portal to receive your signing bonus",
    
    # Fake Check / Equipment Scams
    "We will send you a check for $2000 to purchase your home office equipment from our vendor",
    "Deposit this digital check and wire back the remaining balance for office setup",
    "The company will provide a check for your MacBook; you must pay the insurance fee first",
    "We provide the funds for your home office via a mobile deposit check",
    
    # High Pressure / Unrealistic Promises
    "Immediate joining! No interview required! Limited seats left, act now!",
    "CONGRATULATIONS!!! You are selected without any technical round. Pay fee now.",
    "WhatsApp us immediately to secure your position before it is gone.",
    "Work from home. No experience needed. 1 lakh per month guaranteed income.",
    "Earn massive income with zero skills. Quick selection process via WhatsApp."
]

# --- CATEGORY 2: LEGITIMATE CORPORATE BASELINE ---
legit_texts = [
    # Standard Recruitment
    "Your interview is scheduled for tomorrow", "Please share your updated resume",
    "We are pleased to offer you the position", "Your joining date is next Monday",
    "Please complete the background verification form", "Welcome to the team",
    "Please attend the technical interview online", "Your onboarding session starts next week",
    
    # Verification & Compliance
    "The background check will be conducted by a third-party agency like FirstAdvantage",
    "Please upload your previous 3 months' salary slips and Form 16 for verification",
    "Your offer is contingent upon a successful reference check and academic audit",
    "Please provide your UAN number for Provident Fund (PF) transfer",
    
    # Professional Logistics
    "The company-provided laptop will be shipped via BlueDart after your day one induction",
    "The technical round will focus on Data Structures, Algorithms, and System Design",
    "Please join the Microsoft Teams link provided in the calendar invite for the HR round",
    "You will receive your corporate email credentials during the orientation session",
    "All interview feedback will be shared within 3-5 business days",
    
    # Benefits & Legal
    "The role includes comprehensive group medical insurance and a 401k matching plan",
    "Please review the Non-Disclosure Agreement (NDA) attached with your employment contract",
    "Your variable pay is tied to the annual performance review cycle in March",
    "The company will never ask for any payment or deposit during the recruitment process",
    "Please refer to the employee handbook for our leave and holiday policy"
]

# --- TRAINING ENGINE CONFIGURATION ---
texts = scam_texts + legit_texts
labels = [1] * len(scam_texts) + [0] * len(legit_texts)

# Image of an NLP model training pipeline with TF-IDF and Logistic Regression


# Pipeline with optimized parameters
model = Pipeline([
    ("tfidf", TfidfVectorizer(
        ngram_range=(1, 2), # Captures both single words and common pairs
        stop_words='english', # Removes common filler words
        max_df=0.9, # Ignores words that appear in 90%+ of texts
        min_df=1 # Keeps all rare but specific scam keywords
    )),
    ("classifier", LogisticRegression(
        C=10.0, # Stronger regularization for a small dataset
        class_weight='balanced' # Handles slight imbalances between classes
    )),
])

# Training
model.fit(texts, labels)

# Serialization
model_path = Path(__file__).resolve().parent / "models" / "scam_classifier.pkl"
model_path.parent.mkdir(exist_ok=True)
joblib.dump(model, model_path)

print(f"Smarter model trained with {len(texts)} samples and saved successfully.")