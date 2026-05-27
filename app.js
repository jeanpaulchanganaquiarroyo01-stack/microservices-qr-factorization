const express = require('express');

const app = express();

app.use(express.json());

app.post('/stats', (req, res) => {

    const { Q, R } = req.body;

    const allValues = [...Q.flat(), ...R.flat()];

    const max = Math.max(...allValues);

    const min = Math.min(...allValues);

    const sum = allValues.reduce((a, b) => a + b, 0);

    const average = sum / allValues.length;

    const diagonal = isDiagonal(R);

    res.json({
        max,
        min,
        sum,
        average,
        diagonal
    });

});

function isDiagonal(matrix) {

    for (let i = 0; i < matrix.length; i++) {

        for (let j = 0; j < matrix[i].length; j++) {

            if (i !== j && matrix[i][j] !== 0) {
                return false;
            }
        }
    }

    return true;
}

app.listen(3000, () => {
    console.log('Node API running');
});