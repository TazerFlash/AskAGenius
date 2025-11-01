# Ask A Genius

Welcome to **Ask A Genius**, an interactive digital museum where you can converse with AI-powered personas of the greatest scientific minds in history. This application allows you to ask questions, challenge assumptions, and receive tailored explanations to make learning about science fun and engaging.

## Features

- **Scientist Gallery**: Browse and select from a curated list of historical scientific figures like Albert Einstein, Marie Curie, and Nikola Tesla.
- **AI-Powered Routing**: Ask a general question on the home page, and the application uses an AI model to determine which genius is best suited to answer it.
- **Interactive Chat**: Engage in a real-time conversation with the selected scientist's AI persona. Each persona is engineered to have a unique speaking style, knowledge base, and personality.
- **Text-to-Speech**: Listen to the AI's responses with a built-in audio generation feature.
- **AI Video Generation**: For complex visual concepts, the AI can generate a short, cinematic video to help illustrate its explanation.

## Tech Stack

- **Framework**: Angular (v20+)
  - **Standalone Components**: The entire application is built using modern, standalone Angular components.
  - **Signals**: State management is handled reactively and efficiently using Angular Signals.
  - **Zoneless**: The app is bootstrapped with `provideZonelessChangeDetection()` for improved performance.
- **Styling**: Tailwind CSS for a utility-first, responsive design.
- **Language**: TypeScript
- **AI Backend**: Google Gemini API (`@google/genai`)
  - **`gemini-2.5-flash`**: Used for all text-based generation, including chat responses and AI routing.
  - **`veo-2.0-generate-001`**: Used for the powerful text-to-video generation feature.

## Project Structure

The application is organized into a modular and maintainable structure:

```
/src
|-- /components
|   |-- /chat       # The main chat interface component
|   |-- /home       # The landing page and scientist gallery
|-- /models
|   |-- scientist.model.ts # TypeScript interfaces for data structures
|-- /services
|   |-- genius.service.ts  # Central state management service
|   |-- gemini.service.ts  # Service for all Gemini API interactions
|-- app.component.ts    # Root component, switches between home and chat views
|-- app.component.html  # Root component template
...
index.html              # Main HTML file, loads Tailwind CSS
index.tsx               # Bootstraps the Angular application
```

## Core Technical Concepts

### 1. State Management with Signals

The application employs a centralized state management pattern using Angular Signals within the `GeniusService`.

- **`GeniusService`** acts as a single source of truth for shared application state, such as the list of scientists, the current view (`home` or `chat`), the selected scientist, and the chat history.
- Using signals (`signal()`, `computed()`, `effect()`) provides a highly efficient and fine-grained change detection mechanism, which works seamlessly in a zoneless Angular application.

### 2. AI Persona Engineering

The distinct personality of each scientist is not accidental. It's achieved through detailed prompt engineering in `genius.service.ts`.

- Each `Scientist` object contains a `knowledgeBase` property. This is a comprehensive system prompt passed to the Gemini API.
- This prompt instructs the AI on its persona, speaking style, areas of expertise, and even special instructions, like how to format a video generation prompt.
- **Video Prompt Instruction**: The AI is specifically instructed to wrap cinematic video prompts within `<VIDEO_PROMPT>` tags, which the application can then parse to trigger video generation.

### 3. AI-Powered Routing

The "find the right genius" feature on the homepage is a clever use of the LLM as a classifier.

- The `findBestScientist` method in `GeminiService` constructs a prompt that asks the Gemini model to choose the most appropriate scientist from a list based on the user's question.
- The model's simple text response (the scientist's name) is then used to route the user to the correct chat session.

### 4. Handling Long-Running Operations (Video Generation)

Generating a video is not an instantaneous process. The application handles this asynchronous, long-running task gracefully.

- The `generateVideoFromPrompt` method in `GeminiService` initiates the video generation and receives an `operation` object from the API.
- It then enters a `while` loop, polling the `ai.operations.getVideosOperation` endpoint every 10 seconds to check the status.
- The UI remains responsive during this time, showing a "generating" message. Once the operation is `done`, the video URL is retrieved and displayed in the chat.

## How to Run

To run this application, you need a Google Gemini API key.

1.  **Set up Environment Variable**: The application is hardcoded to look for the API key in `process.env.API_KEY`. You must set this environment variable in your development environment.

    **Example (on macOS/Linux):**
    ```bash
    export API_KEY="YOUR_API_KEY_HERE"
    ```

    **Note**: Do not hardcode your API key directly into the source code.

2.  **Run the Application**: Once the environment variable is set, you can serve the application using your development server. The app will automatically pick up the key to initialize the `GeminiService`.
