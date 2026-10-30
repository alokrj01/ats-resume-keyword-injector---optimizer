from google import genai
from app.core.config import settings


def list_gemini_models():
    client = genai.Client(
        api_key=settings.GEMINI_API_KEY
    )

    print("\nAvailable Gemini models supporting content generation:\n")

    try:
        for model in client.models.list():
            supported_actions = model.supported_actions or []

            if "generateContent" in supported_actions:
                print(f"Model: {model.name}")
                print(f"Display name: {model.display_name}")
                print(f"Input token limit: {model.input_token_limit}")
                print(f"Output token limit: {model.output_token_limit}")
                print("-" * 50)

    except Exception as error:
        print(f"Failed to retrieve models: {error}")


if __name__ == "__main__":
    list_gemini_models()
