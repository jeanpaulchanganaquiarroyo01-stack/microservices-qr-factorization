package main

import (
	"encoding/json"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors" // 1. Importación indispensable
	"gonum.org/v1/gonum/mat"
)

type MatrixRequest struct {
	Matrix [][]float64 `json:"matrix"`
}

func main() {
	app := fiber.New()

	// 2. CONFIGURACIÓN DE CORS
	// Esto habilita que tu SPA en Vue 3 consuma la API sin bloqueos del navegador
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*", // En el futuro puedes especificar la URL exacta de tu frontend
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "POST, GET, OPTIONS",
	}))

	// Health Check / Ruta raíz consolidada
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "Go QR API running - Process Validated",
		})
	})

	app.Post("/qr", func(c *fiber.Ctx) error {
		var req MatrixRequest

		// 1. Parsing del Body
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"error": "invalid body",
			})
		}

		// 2. Validación de Matriz Vacía
		if len(req.Matrix) == 0 {
			return c.Status(400).JSON(fiber.Map{
				"error": "matrix is empty",
			})
		}

		cols := len(req.Matrix[0])

		// 3. Validación de consistencia rectangular
		for _, row := range req.Matrix {
			if len(row) != cols {
				return c.Status(400).JSON(fiber.Map{
					"error": "matrix must be rectangular",
				})
			}
		}

		// 4. EJECUCIÓN DE LA ROTACIÓN (Transposición de la matriz original)
		rotatedMatrix := rotateMatrix(req.Matrix)
		rotatedRows := len(rotatedMatrix)
		rotatedCols := len(rotatedMatrix[0])

		// 5. Aplanamiento de la matriz ROTADA para Gonum
		data := make([]float64, 0, rotatedRows*rotatedCols)
		for _, row := range rotatedMatrix {
			data = append(data, row...)
		}

		// 6. Factorización QR sobre la matriz rotada
		A := mat.NewDense(rotatedRows, rotatedCols, data)
		var qr mat.QR
		qr.Factorize(A)

		var q mat.Dense
		var r mat.Dense
		qr.QTo(&q)
		qr.RTo(&r)

		qrResponse := map[string]interface{}{
			"Q": matrixToSlice(&q),
			"R": matrixToSlice(&r),
		}

		// 7. Envío de datos por HTTP al microservicio de Node.js
		stats, err := sendToNode(qrResponse)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		// 8. Respuesta Unificada al Cliente
		return c.JSON(fiber.Map{
			"matrix_rotated": rotatedMatrix,
			"qr":             qrResponse,
			"stats":          stats,
		})
	})

	// 3. ASIGNACIÓN DINÁMICA DEL PUERTO PARA RENDER
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080" // Si está en local, usará el 8080 por defecto
	}

	log.Println("Servidor corriendo en el puerto:", port)
	log.Fatal(app.Listen(":" + port))
}

// Función auxiliar para rotar/transponer matrices rectangulares
func rotateMatrix(matrix [][]float64) [][]float64 {
	r := len(matrix)
	c := len(matrix[0])

	// Dimensiones invertidas para la transposición
	result := make([][]float64, c)
	for i := range result {
		result[i] = make([]float64, r)
	}

	for i := 0; i < r; i++ {
		for j := 0; j < c; j++ {
			result[j][i] = matrix[i][j]
		}
	}
	return result
}

func matrixToSlice(m mat.Matrix) [][]float64 {
	r, c := m.Dims()
	result := make([][]float64, r)
	for i := 0; i < r; i++ {
		result[i] = make([]float64, c)
		for j := 0; j < c; j++ {
			result[i][j] = m.At(i, j)
		}
	}
	return result
}

func sendToNode(payload interface{}) (map[string]interface{}, error) {
	nodeURL := os.Getenv("NODE_API_URL")
	jsonData, _ := json.Marshal(payload)

	statusCode, body, errs := fiber.Post(nodeURL + "/stats").
		Body(jsonData).
		ContentType("application/json").
		Bytes()

	if len(errs) > 0 {
		log.Println(errs)
		return nil, errs[0]
	}

	log.Println("Node response status:", statusCode)
	var result map[string]interface{}
	err := json.Unmarshal(body, &result)
	if err != nil {
		log.Println("Unmarshal error:", err)
		return nil, err
	}

	return result, nil
}
