import os
from dotenv import load_dotenv
from google import genai

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
api_key = os.getenv("GOOGLE_API_KEY")

try:
    client = genai.Client(api_key=api_key)
    print("Testing chat model listing...")
    for m in client.models.list():
        if "generateContent" in m.supported_actions:
            print(f"Chat Model: {m.name}")
except Exception as e:
    print("GenAI Error:", e)
