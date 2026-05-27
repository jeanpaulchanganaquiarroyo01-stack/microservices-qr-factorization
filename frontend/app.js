const { createApp, ref, onMounted } = Vue;

createApp({
    setup() {
        const rows = ref(3);
        const cols = ref(2);
        const matrixData = ref([]);
        const results = ref(null);
        const errorMessage = ref(null);
        
        const jwtToken = ref(null);
        // URL base de tu backend en Render
        const API_BASE = 'https://microservices-qr-factorization.onrender.com';

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

        const loginAndGetToken = async () => {
            try {
                const loginUrl = `${API_BASE}/login`;

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
                jwtToken.value = data.token; 
                console.log('🔒 Autenticación JWT exitosa');
            } catch (error) {
                console.error('Error en login:', error);
                errorMessage.value = "Error de seguridad: No se pudo establecer conexión segura.";
            }
        };

        const processPipeline = async () => {
            errorMessage.value = null;
            
            if (!jwtToken.value) {
                errorMessage.value = "Falta el token de autenticación. Intentando reconectar...";
                await loginAndGetToken();
                if (!jwtToken.value) return;
            }

            try {
                const backendUrl = `${API_BASE}/qr`;

                const response = await fetch(backendUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${jwtToken.value}` 
                    },
                    body: JSON.stringify({ matrix: matrixData.value })
                });

                if (!response.ok) {
                    if (response.status === 401) {
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

        onMounted(async () => {
            generateMatrix();
            await loginAndGetToken(); 
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