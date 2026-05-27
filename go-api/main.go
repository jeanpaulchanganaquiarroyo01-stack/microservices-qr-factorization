package main

import (
	"encoding/json"
	"log"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors" // Modificación 1: Importación de CORS
	"github.com/golang-jwt/jwt/v5"
	"gonum.org/v1/gonum/mat"
)

type MatrixRequest struct {
	Matrix [][]float64 `json:"matrix"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type CustomClaims struct {
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func main() {
	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins:     "https://matrix-app-frontend.onrender.com",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "POST, GET, OPTIONS",
		AllowCredentials: true,
	}))

	app.Post("/login", func(c *fiber.Ctx) error {
		var req LoginRequest

		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Cuerpo de petición inválido"})
		}

		if req.Username != "admin" || req.Password != "interseguro2026" {
			return c.Status(401).JSON(fiber.Map{"error": "Credenciales incorrectas"})
		}

		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			jwtSecret = "ClaveSecretaSuperSeguraInterseguro2026"
		}

		claims := CustomClaims{
			Username: req.Username,
			Role:     "Analista",
			RegisteredClaims: jwt.RegisteredClaims{
				ExpiresAt: jwt.NewNumericDate(time.Now().Add(2 * time.Hour)),
				IssuedAt:  jwt.NewNumericDate(time.Now()),
			},
		}

		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, err := token.SignedString([]byte(jwtSecret))
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "No se pudo generar el token"})
		}

		return c.JSON(fiber.Map{
			"token": tokenString,
		})
	})

	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "Go QR API running - Process Validated",
		})
	})

	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"message": "Go QR API running - Process Validated",
		})
	})

	app.Post("/qr", jwtMiddleware(), func(c *fiber.Ctx) error {
		var req MatrixRequest

		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{
				"error": "invalid body",
			})
		}

		if len(req.Matrix) == 0 {
			return c.Status(400).JSON(fiber.Map{
				"error": "matrix is empty",
			})
		}

		cols := len(req.Matrix[0])

		for _, row := range req.Matrix {
			if len(row) != cols {
				return c.Status(400).JSON(fiber.Map{
					"error": "matrix must be rectangular",
				})
			}
		}

		rotatedMatrix := rotateMatrix(req.Matrix)
		rotatedRows := len(rotatedMatrix)
		rotatedCols := len(rotatedMatrix[0])

		data := make([]float64, 0, rotatedRows*rotatedCols)
		for _, row := range rotatedMatrix {
			data = append(data, row...)
		}

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

		stats, err := sendToNode(qrResponse)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{
				"error": err.Error(),
			})
		}

		return c.JSON(fiber.Map{
			"matrix_rotated": rotatedMatrix,
			"qr":             qrResponse,
			"stats":          stats,
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	app.Listen(":" + port)
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

// Middleware personalizado para proteger rutas con JWT
func jwtMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// 1. Extraer la cabecera Authorization
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(401).JSON(fiber.Map{"error": "Falta el token de autenticación"})
		}

		// 2. Verificar el formato "Bearer <token>"
		if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
			return c.Status(401).JSON(fiber.Map{"error": "Formato de token inválido (debe ser Bearer)"})
		}
		tokenString := authHeader[7:]

		// 3. Obtener la clave secreta
		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			jwtSecret = "ClaveSecretaSuperSeguraInterseguro2026"
		}

		// 4. Parsear y validar el token
		token, err := jwt.ParseWithClaims(tokenString, &CustomClaims{}, func(t *jwt.Token) (interface{}, error) {
			// Validar que el método de firma sea HS256
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.NewError(401, "Método de firma inesperado")
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			return c.Status(401).JSON(fiber.Map{"error": "Token inválido o expirado"})
		}

		// 5. Si todo está perfecto, guardar los datos del usuario en el contexto y continuar
		if claims, ok := token.Claims.(*CustomClaims); ok {
			c.Locals("username", claims.Username)
			c.Locals("role", claims.Role)
		}

		return c.Next()
	}
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
