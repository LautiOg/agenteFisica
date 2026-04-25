import os
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

api_key = os.getenv("GOOGLE_API_KEY")
print(f"Key loaded: {'Yes' if api_key else 'No'}")

try:
    from google import genai
    client = genai.Client(api_key=api_key)
    print("Testing embed model listing...")
    for m in client.models.list():
        if "embedContent" in m.supported_actions:
            print(f"Model supported: {m.name}")
except Exception as e:
    print("GenAI Error:", e)
