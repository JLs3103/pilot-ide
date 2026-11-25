// Package api provides API endpoints for the application.

package api

import (
	"net/http"
	"github.com/gin-gonic/gin"
)

// HealthHandler handles the /health endpoint.
func HealthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
	})
}

// RegisterRoutes registers the health endpoint.
func RegisterRoutes(r *gin.Engine) {
	r.GET("/health", HealthHandler)
}
