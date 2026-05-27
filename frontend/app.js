const { createApp, ref, onMounted } = Vue;

createApp({
    setup() {
        const rows = ref(3);
        const cols = ref(2);
        const matrixData = ref([]);
        const results = ref(null);
        const errorMessage = ref(null);
        
        // 🔑 Nueva variable reactiva para almacenar el JWT Token
        const jwtToken = ref(null);

        // Generar matriz aleatoria
        const generateMatrix = () => {
            const newMatrix = [];
            for (let i = 0; i < rows.value; i++) {
                const row = [];
                for (let j = 0; j < cols.value; j++) {
                    row.push(Math.floor(Math.random() * 10) + 1);
                }
                newMatrix.push(row);
            }
            matrixData.value = newMatrix;
        };

        // 🔐 Función para autenticarse automáticamente con el backend de Go
        const loginAndGetToken = async () => {
            try {
                const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const loginUrl = isLocal 
                    ? 'http://localhost:8080/login' 
                    : 'https://microservices-qr-factorization.onrender.com/login'; // Usamos tu URL real de Render

                const response = await fetch(loginUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'admin',
                        password: 'interseguro2026'
                    })
                });

                if (!response.ok) throw new Error('No se pudo autenticar el cliente web');
                
                const data = await response.json();
                jwtToken.value = data.token; // Guardamos el token de acceso
                console.log('🔒 Autenticación JWT exitosa');
            } catch (error) {
                console.error('Error en login:', error);
                errorMessage.value = "Error de seguridad: No se pudo establecer conexión segura.";
            }
        };

        // Procesar matriz enviando el token en la cabecera
        const processPipeline = async () => {
            errorMessage.value = null;
            
            // Verificación previa de seguridad
            if (!jwtToken.value) {
                errorMessage.value = "Falta el token de autenticación. Intentando reconectar...";
                await loginAndGetToken();
                if (!jwtToken.value) return;
            }

            try {
                const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                
                const backendUrl = isLocal 
                    ? 'http://localhost:8080/qr' 
                    : 'https://microservices-qr-factorization.onrender.com/qr'; // Tu URL real de Render

                const response = await fetch(backendUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${jwtToken.value}` // 👈 ¡OJO AQUÍ! Inyectamos el Bearer token
                    },
                    body: JSON.stringify({ matrix: matrixData.value })
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        // Si el token expiró, reintentamos el login una vez
                        await loginAndGetToken();
                        return processPipeline();
                    }
                    const errData = await response.json();
                    throw new Error(errData.error || 'Fallo en el servidor');
                }

                results.value = await response.json();
            } catch (error) {
                errorMessage.value = error.message;
                results.value = null;
            }
        };

        // Al cargar el componente, inicializamos la matriz y el Token
        onMounted(async () => {
            generateMatrix();
            await loginAndGetToken(); // 🚀 El frontend se loguea de inmediato al abrir la página
        });

        return {
            rows,
            cols,
            matrixData,
            results,
            errorMessage,
            generateMatrix,
            processPipeline
        };
    }
}).mount('#app');