package rollup

import (
	"testing"
	"time"
)

func TestAggregate_GroupsByHourProjectModel(t *testing.T) {
	hour := time.Date(2026, 4, 3, 10, 0, 0, 0, time.UTC)
	buckets := Aggregate([]RequestUsage{
		{Project: "proj-a", Model: "sonnet", HourStartUTC: hour, InputTokens: 1, OutputTokens: 2, CacheReadTokens: 3, CacheCreationTokens: 4},
		{Project: "proj-a", Model: "sonnet", HourStartUTC: hour, InputTokens: 5, OutputTokens: 6, CacheReadTokens: 7, CacheCreationTokens: 8},
		{Project: "proj-b", Model: "haiku", HourStartUTC: hour, InputTokens: 9, OutputTokens: 10, CacheReadTokens: 11, CacheCreationTokens: 12},
	})

	if len(buckets) != 2 {
		t.Fatalf("len(buckets) = %d, want 2", len(buckets))
	}

	if buckets[0].Project != "proj-a" || buckets[0].Model != "sonnet" || buckets[0].Requests != 2 || buckets[0].TotalTokens != 36 {
		t.Fatalf("unexpected first bucket: %+v", buckets[0])
	}
	if buckets[1].Project != "proj-b" || buckets[1].Model != "haiku" || buckets[1].Requests != 1 || buckets[1].TotalTokens != 42 {
		t.Fatalf("unexpected second bucket: %+v", buckets[1])
	}
}
