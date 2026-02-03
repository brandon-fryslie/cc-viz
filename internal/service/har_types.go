package service

// HAR format types following the HAR 1.2 specification
// See: http://www.softwareishard.com/blog/har-12-spec/

// HAR is the root object
type HAR struct {
	Log HARLog `json:"log"`
}

// HARLog represents the log object
type HARLog struct {
	Version string     `json:"version"`
	Creator HARCreator `json:"creator"`
	Entries []HAREntry `json:"entries"`
	Comment string     `json:"comment,omitempty"`
}

// HARCreator identifies the tool that created the HAR
type HARCreator struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Comment string `json:"comment,omitempty"`
}

// HAREntry represents a single HTTP request/response pair
type HAREntry struct {
	StartedDateTime string      `json:"startedDateTime"`
	Time            float64     `json:"time"`
	Request         HARRequest  `json:"request"`
	Response        HARResponse `json:"response"`
	Cache           HARCache    `json:"cache"`
	Timings         HARTimings  `json:"timings"`
	ServerIPAddress string      `json:"serverIPAddress,omitempty"`
	Connection      string      `json:"connection,omitempty"`
	Comment         string      `json:"comment,omitempty"`

	// Custom fields (prefixed with _) for proxy-specific data
	ProxyRequestID string `json:"_proxyRequestId,omitempty"`
}

// HARRequest represents an HTTP request
type HARRequest struct {
	Method      string          `json:"method"`
	URL         string          `json:"url"`
	HTTPVersion string          `json:"httpVersion"`
	Cookies     []HARCookie     `json:"cookies"`
	Headers     []HARHeader     `json:"headers"`
	QueryString []HARQueryParam `json:"queryString"`
	PostData    *HARPostData    `json:"postData,omitempty"`
	HeadersSize int             `json:"headersSize"`
	BodySize    int             `json:"bodySize"`
	Comment     string          `json:"comment,omitempty"`
}

// HARResponse represents an HTTP response
type HARResponse struct {
	Status      int         `json:"status"`
	StatusText  string      `json:"statusText"`
	HTTPVersion string      `json:"httpVersion"`
	Cookies     []HARCookie `json:"cookies"`
	Headers     []HARHeader `json:"headers"`
	Content     HARContent  `json:"content"`
	RedirectURL string      `json:"redirectURL"`
	HeadersSize int         `json:"headersSize"`
	BodySize    int         `json:"bodySize"`
	Comment     string      `json:"comment,omitempty"`
}

// HARHeader represents an HTTP header
type HARHeader struct {
	Name    string `json:"name"`
	Value   string `json:"value"`
	Comment string `json:"comment,omitempty"`
}

// HARCookie represents an HTTP cookie
type HARCookie struct {
	Name     string `json:"name"`
	Value    string `json:"value"`
	Path     string `json:"path,omitempty"`
	Domain   string `json:"domain,omitempty"`
	Expires  string `json:"expires,omitempty"`
	HTTPOnly bool   `json:"httpOnly,omitempty"`
	Secure   bool   `json:"secure,omitempty"`
	Comment  string `json:"comment,omitempty"`
}

// HARQueryParam represents a URL query parameter
type HARQueryParam struct {
	Name    string `json:"name"`
	Value   string `json:"value"`
	Comment string `json:"comment,omitempty"`
}

// HARPostData represents POST data
type HARPostData struct {
	MimeType string         `json:"mimeType"`
	Params   []HARPostParam `json:"params,omitempty"`
	Text     string         `json:"text"`
	Comment  string         `json:"comment,omitempty"`
}

// HARPostParam represents a POST parameter
type HARPostParam struct {
	Name        string `json:"name"`
	Value       string `json:"value,omitempty"`
	FileName    string `json:"fileName,omitempty"`
	ContentType string `json:"contentType,omitempty"`
	Comment     string `json:"comment,omitempty"`
}

// HARContent represents response content
type HARContent struct {
	Size        int    `json:"size"`
	Compression int    `json:"compression,omitempty"`
	MimeType    string `json:"mimeType"`
	Text        string `json:"text,omitempty"`
	Encoding    string `json:"encoding,omitempty"`
	Comment     string `json:"comment,omitempty"`
}

// HARCache represents cache state
type HARCache struct {
	BeforeRequest *HARCacheState `json:"beforeRequest,omitempty"`
	AfterRequest  *HARCacheState `json:"afterRequest,omitempty"`
	Comment       string         `json:"comment,omitempty"`
}

// HARCacheState represents cache state details
type HARCacheState struct {
	Expires    string `json:"expires,omitempty"`
	LastAccess string `json:"lastAccess"`
	ETag       string `json:"eTag"`
	HitCount   int    `json:"hitCount"`
	Comment    string `json:"comment,omitempty"`
}

// HARTimings represents timing breakdown
type HARTimings struct {
	Blocked float64 `json:"blocked"`
	DNS     float64 `json:"dns"`
	Connect float64 `json:"connect"`
	Send    float64 `json:"send"`
	Wait    float64 `json:"wait"`
	Receive float64 `json:"receive"`
	SSL     float64 `json:"ssl"`
	Comment string  `json:"comment,omitempty"`
}

// ProxyMetadata contains proxy-specific data from the .meta.json file
type ProxyMetadata struct {
	Version       int      `json:"version"`
	RequestID     string   `json:"request_id"`
	Provider      string   `json:"provider"`
	TargetModel   string   `json:"target_model"`
	ActualModel   string   `json:"actual_model"`
	SubagentName  string   `json:"subagent_name,omitempty"`
	ToolsUsed     []string `json:"tools_used,omitempty"`
	InputTokens   int      `json:"input_tokens,omitempty"`
	OutputTokens  int      `json:"output_tokens,omitempty"`
	CacheRead     int      `json:"cache_read_tokens,omitempty"`
	CacheCreation int      `json:"cache_creation_tokens,omitempty"`
	StopReason    string   `json:"stop_reason,omitempty"`
}

