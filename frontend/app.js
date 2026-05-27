const { createApp, ref, onMounted } = Vue;

createApp({
    setup() {
        const rows = ref(3);
        const cols = ref(2);
        const matrixData = ref([]);
        const results = ref(null);
        const errorMessage = ref(null);

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

        const processPipeline = async () => {
            errorMessage.value = null;
            try {
                const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                
                const backendUrl = isLocal 
                    ? 'http://localhost:8080/qr' 
                    : 'https://matrix-core-go.onrender.com/qr';

                const response = await fetch(backendUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ matrix: matrixData.value })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || 'Fallo en el servidor');
                }

                results.value = await response.json();
            } catch (error) {
                errorMessage.value = error.message;
                results.value = null;
            }
        };

        onMounted(() => {
            generateMatrix();
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