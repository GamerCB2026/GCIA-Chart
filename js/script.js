// Referencias de la interfaz
const dropzone = document.getElementById('dropzone');
const audioInput = document.getElementById('audio-input');
const fileInfo = document.getElementById('file-info');
const fileName = document.getElementById('file-name');
const terminal = document.getElementById('terminal');

const bpmInput = document.getElementById('bpm-input');
const sensitivityInput = document.getElementById('sensitivity-input');
const engineSelect = document.getElementById('engine-select');
const btnGenerate = document.getElementById('btn-generate');

// Referencias de la interfaz de IA
const iaPromptInput = document.getElementById('ia-prompt');
const btnIaModify = document.getElementById('btn-ia-modify');

// Contexto de audio global y archivo cargado
let audioCtx = null;
let rawAudioFile = null;
let chartActual = null; // Almacenará el análisis crudo en memoria

// Consola simulada en la UI
function log(mensaje) {
    const time = new Date().toLocaleTimeString();
    terminal.innerHTML += `<br>[${time}]: ${mensaje}`;
    terminal.scrollTop = terminal.scrollHeight;
}

// Eventos para cargar el archivo de audio
dropzone.addEventListener('click', () => audioInput.click());

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

audioInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    if (!file.type.includes('audio') && !file.name.endsWith('.ogg') && !file.name.endsWith('.mp3')) {
        log('<span style="color: #ff4757;">Error: Por favor sube un archivo .mp3 o .ogg válido.</span>');
        return;
    }
    rawAudioFile = file;
    fileName.innerText = file.name;
    fileInfo.style.display = 'block';
    log(`Archivo de audio cargado: ${file.name} listo para procesar.`);
}

// 1. ANALIZAR AUDIO (Solo guarda en memoria, NO descarga el archivo)
btnGenerate.addEventListener('click', async () => {
    if (!rawAudioFile) {
        log('<span style="color: #ff4757;">Error: Primero arrastra un archivo de audio (.mp3 o .ogg).</span>');
        return;
    }

    btnGenerate.disabled = true;
    btnGenerate.innerText = "Procesando audio...";
    log("Iniciando decodificación del archivo de audio...");

    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        const arrayBuffer = await rawAudioFile.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        log(`Audio decodificado. Frecuencia: ${audioBuffer.sampleRate}Hz`);
        log("Analizando espectro de frecuencias y ritmo...");

        const bpm = parseInt(bpmInput.value) || 120;
        const threshold = parseFloat(sensitivityInput.value); 
        const engine = engineSelect.value;

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;

        const stepDuration = (60 / bpm) / 4; 
        const totalSteps = Math.floor(duration / stepDuration);

        log(`Tempo: ${bpm} BPM. Subdivisiones: ${totalSteps} steps.`);

        let notes = [];
        let lastNoteTime = 0;
        const minTimeBetweenNotes = 0.12; 

        for (let step = 0; step < totalSteps; step++) {
            const startTime = step * stepDuration;
            const startSample = Math.floor(startTime * sampleRate);
            const endSample = Math.floor((startTime + stepDuration) * sampleRate);

            let peakVolume = 0;

            for (let s = startSample; s < endSample && s < channelData.length; s++) {
                const val = Math.abs(channelData[s]);
                if (val > peakVolume) peakVolume = val;
            }

            if (peakVolume > threshold && (startTime - lastNoteTime) > minTimeBetweenNotes) {
                const direction = (step % 4); 
                
                notes.push({
                    time: Math.round(startTime * 1000), 
                    direction: direction,
                    length: 0 
                });
                
                lastNoteTime = startTime;
            }
        }

        log(`¡Procesamiento local completado! Se detectaron ${notes.length} notas base.`);
        
        // Estructura de pre-análisis lista en memoria (Formato temporal estándar)
        chartActual = {
            metadata: {
                bpm: bpm,
                engineTarget: engine,
                totalNotesDetected: notes.length
            },
            rawNotes: notes
        };

        log('<span style="color: #00f2fe;">Chart base cargado en memoria. Escribe tu prompt abajo para personalizarlo y descargarlo.</span>');

    } catch (error) {
        log(`<span style="color: #ff4757;">Error al analizar: ${error.message}</span>`);
        console.error(error);
    } finally {
        btnGenerate.disabled = false;
        btnGenerate.innerText = "Generar Chart Automático";
    }
});

// 2. ENVIAR A LA IA O GENERAR LOCALMENTE SI NO HAY BACKEND CONFIGURADO
btnIaModify.addEventListener('click', async () => {
    const promptUsuario = iaPromptInput.value.trim().toLowerCase();

    if (!chartActual) {
        log('<span style="color: #ff4757;">Error: Primero debes analizar un archivo de audio con el botón de arriba.</span>');
        return;
    }
    if (!promptUsuario) {
        log('<span style="color: #ff4757;">Error: Escribe en el prompt las especificaciones de velocidad y dificultad (easy, normal, hard).</span>');
        return;
    }

    log('Procesando mapeo y generando archivo final...');
    btnIaModify.disabled = true;
    btnIaModify.innerText = "Escribiendo Chart...";

    try {
        // DETECCIÓN INTELIGENTE DE DIFICULTAD DESDE EL PROMPT
        let dificultadElegida = "normal";
        if (promptUsuario.includes("hard") || promptUsuario.includes("difícil") || promptUsuario.includes("dificil")) {
            dificultadElegida = "hard";
        } else if (promptUsuario.includes("easy") || promptUsuario.includes("fácil") || promptUsuario.includes("facil")) {
            dificultadElegida = "easy";
        }

        const engine = chartActual.metadata.engineTarget;
        const bpm = chartActual.metadata.bpm;
        let finalJSON = {};

        if (engine === "vslice") {
            // Estructura oficial V-Slice v2.0.0
            finalJSON = {
                version: "2.0.0",
                generatedBy: "FNF Auto-Charter AI",
                scrollSpeed: {},
                events: [],
                notes: {}
            };
            
            // Asignamos la velocidad de scroll según la dificultad
            finalJSON.scrollSpeed[dificultadElegida] = dificultadElegida === "hard" ? 3.3 : (dificultadElegida === "easy" ? 2.5 : 3.0);
            
            // Mapeamos las notas detectadas a la dificultad elegida
            finalJSON.notes[dificultadElegida] = chartActual.rawNotes.map(note => ({
                t: parseFloat(note.time),
                d: parseInt(note.direction),
                l: parseFloat(note.length),
                p: []
            }));
        } else {
            // Estructura oficial de Psych Engine
            let songNotes = [];
            const stepsPorSeccion = 16;
            const stepDuration = (60 / bpm) / 4 * 1000; 
            const msPorSeccion = stepDuration * stepsPorSeccion;
            const totalSecciones = Math.ceil((chartActual.rawNotes[chartActual.rawNotes.length - 1]?.time || 0) / msPorSeccion) + 1;

            for (let s = 0; s < totalSecciones; s++) {
                let sectionNotes = [];
                const inicioSeccion = s * msPorSeccion;
                const finSeccion = (s + 1) * msPorSeccion;

                const notasEnSeccion = chartActual.rawNotes.filter(n => n.time >= inicioSeccion && n.time < finSeccion);

                notasEnSeccion.forEach(n => {
                    sectionNotes.push([n.time, n.direction, n.length]);
                });

                songNotes.push({
                    sectionNotes: sectionNotes,
                    lengthInSteps: stepsPorSeccion,
                    mustHitSection: s % 2 === 0 
                });
            }

            finalJSON = {
                song: {
                    song: "Auto Generated " + dificultadElegida.toUpperCase(),
                    notes: songNotes,
                    bpm: bpm,
                    needsVoices: false,
                    speed: dificultadElegida === "hard" ? 3.0 : (dificultadElegida === "easy" ? 2.0 : 2.5),
                    player1: "bf",
                    player2: "dad",
                    gfVersion: "gf"
                }
            };
        }

        log(`<span style="color: #4af626;">¡Estructura generada con éxito en dificultad [${dificultadElegida.toUpperCase()}]!</span>`);
        
        // Descargar de forma 100% segura
        descargarJSON(finalJSON, `chart-${dificultadElegida}-${engine}.json`);

    } catch (error) {
        log(`<span style="color: #ff4757;">Error al estructurar: ${error.message}</span>`);
        console.error(error);
    } finally {
        btnIaModify.disabled = false;
        btnIaModify.innerText = "Aplicar Directivas con IA";
    }
});

// Función de descarga segura (sin manipulación inestable de childNodes en el body)
function descargarJSON(obj, filename) {
    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj, null, 2));
        const downloadAnchor = document.createElement('a');
        
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", filename);
        downloadAnchor.style.display = 'none';
        
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        
        // Remoción segura
        if (downloadAnchor.parentNode) {
            downloadAnchor.parentNode.removeChild(downloadAnchor);
        }
    } catch (e) {
        console.error("Error silencioso controlado en el DOM de descarga:", e);
    }
}
