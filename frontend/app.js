const { createApp, ref, onMounted } = Vue;

createApp({
    setup() {
        const rows = ref(3);
        const cols = ref(2);
        const matrixData = ref([]);
        const results = ref(null);
        const errorMessage = ref(null);
        
        const jwtToken = ref(null);
        const API_BASE = 'https://matrix-core-go.onrender.com';

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
                const response = await fetch(`${API_BASE}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: 'admin',
                        password: 'interseguro2026'
                    })
                });

                if (!response.ok) throw new Error('No se pudo autenticar');
                
                const data = await response.json();
                jwtToken.value = data.token; 
            } catch (error) {
                errorMessage.value = "Error de conexión.";
            }
        };

        const processPipeline = async () => {
            errorMessage.value = null;
            
            if (!jwtToken.value) {
                await loginAndGetToken();
                if (!jwtToken.value) return;
            }

            try {
                const response = await fetch(`${API_BASE}/qr`, {
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
                    throw new Error('Error al procesar');
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