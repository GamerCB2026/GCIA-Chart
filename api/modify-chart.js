// api/modify-chart.js
import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    try {
        const { chart, prompt } = req.body;
        const apiKey = process.env.GEMINI_API_KEY; 
        const ai = new GoogleGenAI({ apiKey });

        const systemPrompt = `Eres un experto diseñador de charts (charter) para Friday Night Funkin'.
Recibirás un JSON con un array 'rawNotes' (que contiene notas con la estructura {time, direction}) y un objeto 'metadata'.

Tu tarea es procesar esas notas y estructurar el chart final en base al motor objetivo seleccionado (V-Slice o Psych Engine) y las instrucciones del usuario.

REGLAS DE FORMATO:
1. Si 'engineTarget' es "vslice":
   - El JSON debe seguir la especificación V-Slice v2.0.0.
   - Debe incluir la propiedad "generatedBy": "FNF Auto-Charter AI".
   - Debes buscar en el prompt del usuario palabras clave como "easy", "normal" o "hard" para nombrar la clave dentro del objeto "notes" y la velocidad de scroll correspondiente (scrollSpeed: { [dificultad]: velocidad }). Si no se menciona ninguna, usa "normal" por defecto.
   - El formato de notas en V-Slice es: {"notes": { "nombre_dificultad": [ {"t": tiempo, "d": direccion, "l": sustain_length, "p": []} ] }}

2. Si 'engineTarget' es "psych":
   - Debe tener el formato estándar de Psych Engine: { song: { song: "Auto Generated", notes: [...], bpm: bpm, speed: velocidad, ... } }.

Adapta las notas y la densidad según los adjetivos del prompt del usuario (por ejemplo: si pide "canción lenta", reduce el número de notas o hazlas más espaciadas; si pide "dificultad hard", añade más notas consecutivas o dobles).

Devuelve ÚNICAMENTE el JSON final modificado, sin bloques de código markdown (\`\`\`), sin texto adicional, sin explicaciones.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `${systemPrompt}\n\nDatos del chart cargados:\n${JSON.stringify(chart)}\n\nInstrucción del usuario: ${prompt}`
        });

        const respuestaTexto = response.text.trim();
        const nuevoChart = JSON.parse(respuestaTexto);

        return res.status(200).json({ nuevoChart });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
