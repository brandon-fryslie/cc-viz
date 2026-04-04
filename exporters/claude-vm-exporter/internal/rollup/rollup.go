package rollup

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"time"
)

type RequestUsage struct {
	SourcePath          string
	SessionID           string
	Project             string
	RequestKey          string
	Model               string
	HourStartUTC        time.Time
	FirstSeenAt         time.Time
	InputTokens         int64
	OutputTokens        int64
	CacheReadTokens     int64
	CacheCreationTokens int64
}

type HourlyBucket struct {
	HourStartUTC        time.Time
	Project             string
	Model               string
	Requests            int64
	InputTokens         int64
	OutputTokens        int64
	CacheReadTokens     int64
	CacheCreationTokens int64
	TotalTokens         int64
}

func HourStartUTC(ts time.Time) time.Time {
	return ts.UTC().Truncate(time.Hour)
}

func Aggregate(usages []RequestUsage) []HourlyBucket {
	grouped := make(map[string]*HourlyBucket)

	for _, usage := range usages {
		key := bucketKey(usage.HourStartUTC, usage.Project, usage.Model)
		bucket, ok := grouped[key]
		if !ok {
			bucket = &HourlyBucket{
				HourStartUTC: usage.HourStartUTC.UTC(),
				Project:      usage.Project,
				Model:        usage.Model,
			}
			grouped[key] = bucket
		}

		bucket.Requests++
		bucket.InputTokens += usage.InputTokens
		bucket.OutputTokens += usage.OutputTokens
		bucket.CacheReadTokens += usage.CacheReadTokens
		bucket.CacheCreationTokens += usage.CacheCreationTokens
		bucket.TotalTokens += usage.InputTokens + usage.OutputTokens + usage.CacheReadTokens + usage.CacheCreationTokens
	}

	result := make([]HourlyBucket, 0, len(grouped))
	for _, bucket := range grouped {
		result = append(result, *bucket)
	}

	sort.Slice(result, func(i, j int) bool {
		if result[i].HourStartUTC.Equal(result[j].HourStartUTC) {
			if result[i].Project == result[j].Project {
				return result[i].Model < result[j].Model
			}
			return result[i].Project < result[j].Project
		}
		return result[i].HourStartUTC.Before(result[j].HourStartUTC)
	})

	return result
}

func HashBucket(bucket HourlyBucket) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf(
		"%s|%s|%s|%d|%d|%d|%d|%d|%d",
		bucket.HourStartUTC.UTC().Format(time.RFC3339),
		bucket.Project,
		bucket.Model,
		bucket.Requests,
		bucket.InputTokens,
		bucket.OutputTokens,
		bucket.CacheReadTokens,
		bucket.CacheCreationTokens,
		bucket.TotalTokens,
	)))
	return hex.EncodeToString(sum[:])
}

func bucketKey(hour time.Time, project, model string) string {
	return hour.UTC().Format(time.RFC3339) + "|" + project + "|" + model
}
