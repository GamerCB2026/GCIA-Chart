// CONFIGURACIÓN DE LA API DE GEMINI (Completamente invisible al usuario)
const GEMINI_API_KEY = "AQ.Ab8RN6IkhUhljWaNg7jSv5Ohq8SCTXfk9d9tYol9FeO27g5JxA"; 
const GEMINI_MODEL = "gemini-3-flash-preview";

// Referencias del DOM
const fileInputs = {
    inst: document.getElementById('file-inst'),
    v1: document.getElementById('file-v1'),
    v2: document.getElementById('file-v2')
};

const statusTexts = {
    inst: document.getElementById('status-inst'),
    v1: document.getElementById('status-v1'),
    v2: document.getElementById('status-v2')
};

const terminal = document.getElementById('terminal');
const bpmInput = document.getElementById('bpm-input');
const difficultySelect = document.getElementById('difficulty-select');
const engineSelect = document.getElementById('engine-select');
const btnGenerate = document.getElementById('btn-generate');

const iaPromptInput = document.getElementById('ia-prompt');
const btnIaModify = document.getElementById('btn-ia-modify');

// Almacén de archivos de audio decodificados y crudos
let audioCtx = null;
let rawFiles = { inst: null, v1: null, v2: null };
let chartActual = null; // Guardará el análisis multicanal en memoria

// Consola interactiva en la UI
function log(mensaje) {
    const time = new Date().toLocaleTimeString();
    terminal.innerHTML += `<br>[${time}]: ${mensaje}`;
    terminal.scrollTop = terminal.scrollHeight;
}

// Configurar los listeners de cambios de archivos
Object.keys(fileInputs).forEach(key => {
    fileInputs[key].addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(key, e.target.files[0]);
        }
    });
});

function handleFileSelection(type, file) {
    if (!file.type.includes('audio') && !file.name.endsWith('.ogg') && !file.name.endsWith('.mp3')) {
        log(`<span style="color: #ff4757;">Error [${type.toUpperCase()}]: El archivo debe ser .mp3 o .ogg</span>`);
        return;
    }
    rawFiles[type] = file;
    statusTexts[type].innerText = `✅ ${file.name}`;
    statusTexts[type].classList.remove('text-slate-400');
    statusTexts[type].classList.add('text-green-400', 'font-bold');
    log(`Canal de audio cargado: ${type.toUpperCase()} -> (${file.name})`);
}

// Comprobación de que al menos exista un archivo de audio cargado
function hasAtLeastOneAudio() {
    return rawFiles.inst || rawFiles.v1 || rawFiles.v2;
}

// 1. ANALIZAR AUDIO MULTICANAL
btnGenerate.addEventListener('click', async () => {
    if (!hasAtLeastOneAudio()) {
        log('<span style="color: #ff4757;">Error: Debes cargar al menos un archivo de audio (.ogg o .mp3).</span>');
        return;
    }

    btnGenerate.disabled = true;
    btnGenerate.innerText = "Procesando audios...";
    log("Inicializando Web Audio API context...");

    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        const bpm = parseInt(bpmInput.value) || 120;
        const difficulty = difficultySelect.value;
        const engine = engineSelect.value;

        let analysisData = {
            metadata: {
                bpm: bpm,
                engineTarget: engine,
                baseDifficulty: difficulty,
                channelsAnalyzed: []
            },
            notesByChannel: {
                inst: [],
                v1: [], // Voz Jugador
                v2: []  // Voz Oponente
            }
        };

        for (const [key, file] of Object.entries(rawFiles)) {
            if (file) {
                log(`Decodificando canal [${key.toUpperCase()}]...`);
                const arrayBuffer = await file.arrayBuffer();
                const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                
                analysisData.metadata.channelsAnalyzed.push(key);
                
                const channelData = audioBuffer.getChannelData(0);
                const sampleRate = audioBuffer.sampleRate;
                const duration = audioBuffer.duration;
                const stepDuration = (60 / bpm) / 4; 
                const totalSteps = Math.floor(duration / stepDuration);
                
                const autoThreshold = 0.15; 
                const minTimeBetweenNotes = 0.12; 
                let lastNoteTime = 0;

                for (let step = 0; step < totalSteps; step++) {
                    const startTime = step * stepDuration;
                    const startSample = Math.floor(startTime * sampleRate);
                    const endSample = Math.floor((startTime + stepDuration) * sampleRate);

                    let peakVolume = 0;
                    for (let s = startSample; s < endSample && s < channelData.length; s++) {
                        const val = Math.abs(channelData[s]);
                        if (val > peakVolume) peakVolume = val;
                    }

                    if (peakVolume > autoThreshold && (startTime - lastNoteTime) > minTimeBetweenNotes) {
                        analysisData.notesByChannel[key].push({
                            time: Math.round(startTime * 1000), 
                            direction: (step % 4), 
                            length: 0
                        });
                        lastNoteTime = startTime;
                    }
                }
                log(`Decodificado [${key.toUpperCase()}]: Se estructuraron ${analysisData.notesByChannel[key].length} puntos rítmicos.`);
            }
        }

        chartActual = analysisData;
        log('<span style="color: #00f2fe;">¡Análisis multicanal listo en memoria! Introduce tus instrucciones para la IA de Gemini abajo.</span>');

    } catch (error) {
        log(`<span style="color: #ff4757;">Error de análisis: ${error.message}</span>`);
        console.error(error);
    } finally {
        btnGenerate.disabled = false;
        btnGenerate.innerText = "Generar Chart Automático";
    }
});

// 2. ENVIAR A LA IA DE GEMINI (Con filtro de voces inteligente y auto-recuperación)
btnIaModify.addEventListener('click', async () => {
    const promptUsuario = iaPromptInput.value.trim();

    if (!chartActual) {
        log('<span style="color: #ff4757;">Error: Analiza primero los audios utilizando el botón de arriba.</span>');
        return;
    }
    if (!promptUsuario) {
        log('<span style="color: #ff4757;">Error: Proporciona indicaciones a la IA (ej. "Crea un dueto alternado según las voces").</span>');
        return;
    }

    log('Estableciendo conexión segura con Gemini...');
    btnIaModify.disabled = true;
    btnIaModify.innerText = "La IA está pensando...";

    // System prompt con tus reglas estrictas de filtrado de audios e instrumental
    const systemPrompt = `Eres un experto charter de Friday Night Funkin'. Tu única tarea es estructurar y devolver el JSON del chart optimizado.

REGLAS DE DISTRIBUCIÓN Y FILTRADO DE VOCES (DIRECCIÓN "d"):
1. VOZ 1 (Player / BF): Las notas de 'v1' van SÓLO en los carriles del Jugador: 4, 5, 6, 7. Para calcular la dirección exacta, toma la dirección base (0, 1, 2, 3) y súmale 4.
2. VOZ 2 (Opponent / Dad): Las notas de 'v2' van SÓLO en los carriles del Enemigo: 0, 1, 2, 3.
3. FILTRADO DEL INSTRUMENTAL ('inst'): 
   - El canal 'inst' actúa como ritmo y complemento.
   - Si hay notas activas en 'v1' o 'v2', NO agregues notas de 'inst' en esos mismos instantes de tiempo para evitar saturación de flechas mientras cantan.
   - Si los puntos rítmicos de 'inst' NO coinciden ni se parecen a los tiempos de canto de 'v1' o 'v2', simplemente NO coloques ninguna flecha de 'inst' en esos momentos. Deja que se destaquen las voces limpias.
   - Si no se cargó ninguna voz ('v1' ni 'v2' están presentes), entonces sí distribuye el ritmo de 'inst' equitativamente entre los carriles del enemigo (0-3) y jugador (4-7).

FORMATO DEL ENGINE:
1. Si 'engineTarget' es "vslice":
   - Devuelve estructura V-Slice v2.0.0.
   - JSON: {"version": "2.0.0", "scrollSpeed": { [dificultad]: 2.4 }, "notes": { [dificultad]: [{"t": tiempo, "d": direccion, "l": length, "p": []}] } }

2. Si 'engineTarget' es "psych":
   - Devuelve Psych Engine: { song: { song: "Auto Generated", notes: [...], bpm: bpm, speed: 2.4, player1: "bf", player2: "dad" } }

Devuelve ÚNICAMENTE el JSON estructurado. No agregues explicaciones, introducciones o bloques de código markdown.`;

    // Función auxiliar para realizar la petición fetch
    async function realizarPeticion(modelo) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${systemPrompt}\n\nDatos de análisis rítmico:\n${JSON.stringify(chartActual)}\n\nInstrucción del usuario:\n${promptUsuario}`
                    }]
                }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.15 // Temperatura más baja para mayor precisión matemática
                }
            })
        });

        if (!response.ok) {
            let errorDetallado = "Error desconocido";
            try {
                const errorJson = await response.json();
                if (errorJson && errorJson.error) {
                    errorDetallado = `${errorJson.error.status} - ${errorJson.error.message}`;
                }
            } catch (e) {
                errorDetallado = response.statusText || "Fallo de red / CORS";
            }
            throw new Error(errorDetallado);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    }

    try {
        let textoRespuesta;
        try {
            // Intento 1: Usar tu modelo principal configurado
            log(`Intentando conectar con modelo principal: ${GEMINI_MODEL}...`);
            textoRespuesta = await realizarPeticion(GEMINI_MODEL);
        } catch (errorPrincipal) {
            // Si el servidor está saturado (503/UNAVAILABLE) u ocurre otro error, pasamos al plan B de respaldo
            log(`<span style="color: #e67e22;">Aviso: Modelo principal ocupado o no disponible (${errorPrincipal.message}). Conectando con servidor de respaldo (1.5-flash)...</span>`);
            textoRespuesta = await realizarPeticion("gemini-1.5-flash");
        }
        
        const nuevoChart = JSON.parse(textoRespuesta);

        log('<span style="color: #4af626;">¡La IA procesó con éxito tu chart aplicando tus filtros de voz e instrumental! Descargando archivo...</span>');
        
        const dificultadMapeada = promptUsuario.toLowerCase().includes("hard") ? "hard" : 
                                 (promptUsuario.toLowerCase().includes("easy") ? "easy" : chartActual.metadata.baseDifficulty);

        descargarJSON(nuevoChart, `chart-${dificultadMapeada}-${chartActual.metadata.engineTarget}.json`);

    } catch (error) {
        log(`<span style="color: #ff4757;">Error al procesar con IA: ${error.message}</span>`);
        console.error(error);
    } finally {
        btnIaModify.disabled = false;
        btnIaModify.innerText = "Aplicar Directivas con IA";
    }
});

// Función de descarga segura del JSON estructurado
function descargarJSON(obj, filename) {
    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj, null, 2));
        const downloadAnchor = document.createElement('a');
        
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", filename);
        downloadAnchor.style.display = 'none';
        
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        
        if (downloadAnchor.parentNode) {
            downloadAnchor.parentNode.removeChild(downloadAnchor);
        }
    } catch (e) {
        console.error("Error al gestionar descarga:", e);
    }
}
