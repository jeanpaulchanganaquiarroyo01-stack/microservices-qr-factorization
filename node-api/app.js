const express = require("express");
const app = express();

app.use(express.json());

app.post("/stats", (req, res) => {
    const { Q, R } = req.body;

    if (!Q || !R) {
        return res.status(400).json({ error: "Missing Q or R matrices" });
    }

    // VARIABLES DE AGREGACIÓN (Algoritmo Single-Pass eficiente en memoria)
    let max = -Infinity;
    let min = Infinity;
    let sum = 0;
    let totalElements = 0;

    // Función optimizada para procesar estadísticas en un solo recorrido por matriz
    const processMatrixStats = (matrix) => {
        for (let i = 0; i < matrix.length; i++) {
            for (let j = 0; j < matrix[i].length; j++) {
                const val = matrix[i][j];
                if (val > max) max = val;
                if (val < min) min = val;
                sum += val;
                totalElements++;
            }
        }
    };

    // Procesamos ambas matrices secuencialmente evitando desbordamiento del Call Stack
    processMatrixStats(Q);
    processMatrixStats(R);

    const average = totalElements > 0 ? sum / totalElements : 0;

    // ALGORITMO CORRECTO PARA MATRIZ DIAGONAL
    // Tolerancia epsilon para corregir imprecisiones de coma flotante (ej: 1e-15 devuelto por Go)
    const isDiagonal = (matrix) => {
        const EPSILON = 1e-9; 
        for (let i = 0; i < matrix.length; i++) {
            for (let j = 0; j < matrix[i].length; j++) {
                // Si está fuera de la diagonal principal y el valor absoluto supera el umbral de tolerancia
                if (i !== j && Math.abs(matrix[i][j]) > EPSILON) {
                    return false; // Cortocircuito inmediato
                }
            }
        }
        return true;
    };

    const response = {
        max,
        min,
        average,
        sum,
        QIsDiagonal: isDiagonal(Q),
        RIsDiagonal: isDiagonal(R)
    };

    console.log("Calculated Stats:", response);
    res.json(response);
});

app.listen(3000, () => {
    console.log("Node API running on port 3000");
});