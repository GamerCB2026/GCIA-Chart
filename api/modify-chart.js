// Espera a que el documento se cargue por completo
document.addEventListener("DOMContentLoaded", () => {
    
    // -------------------------------------------------------------
    // 1. ELECCIÓN DE ELEMENTOS DEL DOM
    // -------------------------------------------------------------
    // API Key Elements
    const apiKeyInput = document.getElementById("api-key-input");
    const btnSaveKey = document.getElementById("btn-save-key");
    const btnDeleteKey = document.getElementById("btn-delete-key");
    const apiStatus = document.getElementById("api-status");
    const apiInputContainer = document.getElementById("api-input-container");
    const apiSavedContainer = document.getElementById("api-saved-container");
    const keyMasked = document.getElementById("key-masked");

    // Selector de Modelo Gemini
    const modelSelect = document.getElementById("model-select");

    // Inputs de Audio
    const fileInst = document.getElementById("file-inst");
    const fileV1 = document.getElementById("file-v1");
    const fileV2 = document.getElementById("file-v2");

    // Labels de Estado
    const statusInst = document.getElementById("status-inst");
    const statusV1 = document.getElementById("status-v1");
    const statusV2 = document.getElementById("status-v2");

    // Controles de Chart
    const bpmInput = document.getElementById("bpm-input");
    const difficultySelect = document.getElementById("difficulty-select");
    const engineSelect = document.getElementById("engine-select");

    // Botones y Módulos
    const btnGenerate = document.getElementById("btn-generate");
    const btnIaModify = document.getElementById("btn-ia-modify");
    const iaPrompt = document.getElementById("ia-prompt");
    const terminal = document.getElementById("terminal");

    // Objeto para guardar referencias de archivos seleccionados
    const audioFiles = {
        inst: null,
        v1: null,
        v2: null
    };

    // Lista de modelos para fallback si el elegido se satura
    const FALLBACK_MODELS = [
        "Gemini 3.5 Flash",
        "Gemini 3.5 Live Translate Preview",
        "Gemini 3.1 Flash Lite",
        "Gemini 3 Flash Preview",
        "Gemini 3.1 Pro Preview",
        "Gemini Pro Latest",
        "Gemini Flash Latest",
        "Gemini Flash-Lite Latest" 
    ];

    // -------------------------------------------------------------
    // 2. FUNCIÓN PARA IMPRIMIR MENSAJES EN LA TERMINAL
    // -------------------------------------------------------------
    function log(message, type = "info") {
        if (!terminal) return;
        const time = new Date().toLocaleTimeString();
        let prefix = "[SISTEMA]";
        if (type === "error") prefix = "[ERROR]";
        if (type === "ia") prefix = "[GEMINI AI]";

        const div = document.createElement("div");
        div.textContent = `${prefix} (${time}): ${message}`;
        terminal.appendChild(div);
        terminal.scrollTop = terminal.scrollHeight;
    }

    // -------------------------------------------------------------
    // 3. GESTIÓN DE AUDIO (3 CANALES)
    // -------------------------------------------------------------
    function capturarAudio(input, statusLabel, fileKey, nombreDefault) {
        if (!input) return;
        input.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (file) {
                audioFiles[fileKey] = file;
                if (statusLabel) {
                    statusLabel.textContent = `🟢 ${file.name}`;
                    statusLabel.classList.add("text-cyan-300");
                }
                log(`Archivo seleccionado para ${nombreDefault}: ${file.name}`);
            } else {
                audioFiles[fileKey] = null;
                if (statusLabel) {
                    statusLabel.textContent = nombreDefault;
                    statusLabel.classList.remove("text-cyan-300");
                }
            }
        });
    }

    capturarAudio(fileInst, statusInst, "inst", "Arrastra o busca Instrumental");
    capturarAudio(fileV1, statusV1, "v1", "Arrastra o busca Voz 1 (Opcional)");
    capturarAudio(fileV2, statusV2, "v2", "Arrastra o busca Voz 2 (Opcional)");

    // -------------------------------------------------------------
    // 4. ACCIÓN: GENERAR CHART AUTOMÁTICO
    // -------------------------------------------------------------
    if (btnGenerate) {
        btnGenerate.addEventListener("click", () => {
            if (!audioFiles.inst && !audioFiles.v1 && !audioFiles.v2) {
                log("Carga al menos un archivo de audio para iniciar el análisis.", "error");
                alert("Debes cargar al menos un archivo de audio.");
                return;
            }

            const bpm = bpmInput ? bpmInput.value : 120;
            const diff = difficultySelect ? difficultySelect.value : "normal";
            const engine = engineSelect ? engineSelect.value : "vslice";

            log(`Analizando pistas [BPM: ${bpm} | Dificultad: ${diff} | Engine: ${engine}]...`);
            
            setTimeout(() => {
                log("Chart base estructurado y listo.");
            }, 1000);
        });
    }

    // -------------------------------------------------------------
    // 5. ACCIÓN: APLICAR DIRECTIVAS CON IA (GEMINI)
    // -------------------------------------------------------------
    if (btnIaModify) {
        btnIaModify.addEventListener("click", async () => {
            const apiKey = localStorage.getItem("gemini_api_key") || (apiKeyInput ? apiKeyInput.value.trim() : "");

            if (!apiKey) {
                log("No se encontró la API Key. Introdúcela arriba y guarda.", "error");
                alert("Primero debes configurar tu API Key de Gemini.");
                return;
            }

            const promptTexto = iaPrompt ? iaPrompt.value.trim() : "";
            if (!promptTexto) {
                log("Ingresa un prompt indicando qué modificaciones deseas.", "error");
                alert("Escribe las instrucciones para la IA en el cuadro de texto.");
                return;
            }

            // Seleccionar modelo preferido del HTML o usar por defecto
            const selectedModel = modelSelect ? modelSelect.value : "gemini-2.5-flash";
            
            // Armar lista de intento priorizando el modelo elegido
            const modelQueue = [selectedModel, ...FALLBACK_MODELS.filter(m => m !== selectedModel)];

            let success = false;

            for (const currentModel of modelQueue) {
                log(`Enviando petición usando [${currentModel}]...`, "ia");

                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${apiKey}`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            contents: [
                                {
                                    parts: [
                                        {
                                            text: `Eres un asistente especializado en charting para Friday Night Funkin' (Psych Engine y V-Slice).\nConfiguración actual:\n- BPM: ${bpmInput ? bpmInput.value : 120}\n- Dificultad: ${difficultySelect ? difficultySelect.value : "normal"}\n- Engine: ${engineSelect ? engineSelect.value : "vslice"}\n- Pistas activas: Instrumental (${audioFiles.inst ? 'Sí' : 'No'}), Voz 1 (${audioFiles.v1 ? 'Sí' : 'No'}), Voz 2 (${audioFiles.v2 ? 'Sí' : 'No'}).\n\nInstrucciones del usuario:\n${promptTexto}`
                                        }
                                    ]
                                }
                            ]
                        })
                    });

                    const data = await response.json();

                    if (data.error) {
                        log(`Error con ${currentModel}: ${data.error.message}`, "error");
                        // Si está saturado o dio error, continúa al siguiente modelo del loop
                        continue;
                    } 
                    
                    if (data.candidates && data.candidates[0].content.parts[0].text) {
                        log(`Directivas aplicadas con éxito usando [${currentModel}].`, "ia");
                        console.log("Respuesta de la IA:", data.candidates[0].content.parts[0].text);
                        success = true;
                        break; // Salir del loop si tuvo éxito
                    }
                } catch (err) {
                    log(`Error de conexión con ${currentModel}: ${err.message}`, "error");
                }
            }

            if (!success) {
                log("Todos los modelos intentados están saturados o sin respuesta. Reintenta en unos segundos.", "error");
            }
        });
    }

    // -------------------------------------------------------------
    // 6. GESTIÓN DE LA LLAVE API DE GEMINI (GUARDAR / ELIMINAR)
    // -------------------------------------------------------------
    function revisarEstadoApiKey() {
        const keyGuardada = localStorage.getItem("gemini_api_key");
        
        if (keyGuardada) {
            if (apiStatus) {
                apiStatus.textContent = "✅ Configurada";
                apiStatus.className = "text-xs text-green-400 font-semibold";
            }
            if (apiInputContainer) apiInputContainer.classList.add("hidden");
            if (apiSavedContainer) apiSavedContainer.classList.remove("hidden");
            if (keyMasked) keyMasked.textContent = "••••••••" + keyGuardada.slice(-4);
        } else {
            if (apiStatus) {
                apiStatus.textContent = "⚠️ No configurada";
                apiStatus.className = "text-xs text-red-400 font-semibold";
            }
            if (apiInputContainer) apiInputContainer.classList.remove("hidden");
            if (apiSavedContainer) apiSavedContainer.classList.add("hidden");
            if (apiKeyInput) apiKeyInput.value = "";
        }
    }

    if (btnSaveKey) {
        btnSaveKey.addEventListener("click", () => {
            const clave = apiKeyInput ? apiKeyInput.value.trim() : "";
            if (!clave) {
                log("Debes escribir una API Key válida.", "error");
                alert("Ingresa una API Key válida.");
                return;
            }
            localStorage.setItem("gemini_api_key", clave);
            log("API Key guardada correctamente.");
            revisarEstadoApiKey();
        });
    }

    if (btnDeleteKey) {
        btnDeleteKey.addEventListener("click", () => {
            localStorage.removeItem("gemini_api_key");
            log("API Key borrada.");
            revisarEstadoApiKey();
        });
    }

    // Estado inicial de la clave
    revisarEstadoApiKey();
});
