package contractgen

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

func GenerateOpenAPI(swaggerPath string) ([]byte, error) {
	content, err := os.ReadFile(swaggerPath)
	if err != nil {
		return nil, fmt.Errorf("read Swagger: %w", err)
	}
	var swagger map[string]any
	if err := json.Unmarshal(content, &swagger); err != nil {
		return nil, fmt.Errorf("decode Swagger: %w", err)
	}
	if swagger["swagger"] != "2.0" {
		return nil, fmt.Errorf("expected Swagger 2.0 input")
	}
	paths, ok := swagger["paths"].(map[string]any)
	if !ok || len(paths) == 0 {
		return nil, fmt.Errorf("Swagger paths are required")
	}
	convertedPaths := make(map[string]any, len(paths))
	for route, rawPath := range paths {
		pathItem, ok := rawPath.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("Swagger path %s is not an object", route)
		}
		convertedPath := make(map[string]any, len(pathItem))
		for method, rawOperation := range pathItem {
			if method != "get" && method != "post" && method != "put" && method != "delete" && method != "patch" {
				convertedPath[method] = rewriteRefs(rawOperation)
				continue
			}
			operation, ok := rawOperation.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("Swagger operation %s %s is not an object", method, route)
			}
			converted, err := convertOperation(operation)
			if err != nil {
				return nil, fmt.Errorf("convert %s %s: %w", method, route, err)
			}
			convertedPath[method] = converted
		}
		convertedPaths[route] = convertedPath
	}
	info, _ := swagger["info"].(map[string]any)
	if info == nil {
		info = map[string]any{}
	}
	info["title"] = "ECP HTTP API"
	info["version"] = "v1"
	document := map[string]any{
		"openapi":    "3.0.3",
		"info":       info,
		"paths":      convertedPaths,
		"components": map[string]any{"schemas": rewriteRefs(swagger["definitions"])},
	}
	encoded, err := yaml.Marshal(document)
	if err != nil {
		return nil, fmt.Errorf("encode OpenAPI: %w", err)
	}
	return encoded, nil
}

func convertOperation(input map[string]any) (map[string]any, error) {
	output := make(map[string]any)
	for _, key := range []string{"summary", "description", "operationId", "tags", "deprecated", "security"} {
		if value, exists := input[key]; exists {
			output[key] = rewriteRefs(value)
		}
	}
	output["x-ecp-access"] = "public"

	if rawParameters, exists := input["parameters"]; exists {
		parameters, _ := rawParameters.([]any)
		var remaining []any
		for _, rawParameter := range parameters {
			parameter, ok := rawParameter.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("parameter is not an object")
			}
			if parameter["in"] == "body" {
				if _, duplicate := output["requestBody"]; duplicate {
					return nil, fmt.Errorf("multiple body parameters")
				}
				output["requestBody"] = map[string]any{
					"required": parameter["required"],
					"content":  map[string]any{"application/json": map[string]any{"schema": rewriteRefs(parameter["schema"])}},
				}
				continue
			}
			converted := make(map[string]any)
			for _, key := range []string{"name", "in", "description", "required"} {
				if value, exists := parameter[key]; exists {
					converted[key] = value
				}
			}
			converted["schema"] = parameterSchema(parameter)
			remaining = append(remaining, converted)
		}
		if len(remaining) > 0 {
			output["parameters"] = remaining
		}
	}

	rawResponses, ok := input["responses"].(map[string]any)
	if !ok || len(rawResponses) == 0 {
		return nil, fmt.Errorf("responses are required")
	}
	responses := make(map[string]any, len(rawResponses))
	for code, rawResponse := range rawResponses {
		response, ok := rawResponse.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("response %s is not an object", code)
		}
		converted := make(map[string]any)
		if description, exists := response["description"]; exists {
			converted["description"] = description
		} else {
			converted["description"] = "Response"
		}
		if schema, exists := response["schema"]; exists {
			converted["content"] = map[string]any{"application/json": map[string]any{"schema": rewriteRefs(schema)}}
		}
		responses[code] = converted
	}
	output["responses"] = responses
	return output, nil
}

func parameterSchema(parameter map[string]any) map[string]any {
	schema := make(map[string]any)
	for _, key := range []string{"type", "format", "default", "enum", "items", "minimum", "maximum", "minLength", "maxLength"} {
		if value, exists := parameter[key]; exists {
			schema[key] = rewriteRefs(value)
		}
	}
	return schema
}

func rewriteRefs(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		output := make(map[string]any, len(typed))
		for key, child := range typed {
			output[key] = rewriteRefs(child)
		}
		return output
	case []any:
		output := make([]any, len(typed))
		for index, child := range typed {
			output[index] = rewriteRefs(child)
		}
		return output
	case string:
		return strings.ReplaceAll(typed, "#/definitions/", "#/components/schemas/")
	default:
		return value
	}
}
