package source

import (
	"io/fs"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type FileRecord struct {
	Path      string
	Project   string
	SessionID string
	ModTime   time.Time
	Size      int64
}

func ScanProjects(root string) ([]FileRecord, error) {
	files := make([]FileRecord, 0)

	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if !strings.HasSuffix(strings.ToLower(d.Name()), ".jsonl") {
			return nil
		}

		info, err := d.Info()
		if err != nil {
			return err
		}

		project := deriveProject(root, path)
		if project == "" {
			return nil
		}

		files = append(files, FileRecord{
			Path:      path,
			Project:   project,
			SessionID: strings.TrimSuffix(filepath.Base(path), filepath.Ext(path)),
			ModTime:   info.ModTime().UTC(),
			Size:      info.Size(),
		})

		return nil
	})
	if err != nil {
		return nil, err
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].Path < files[j].Path
	})

	return files, nil
}

func deriveProject(root, path string) string {
	rel, err := filepath.Rel(root, path)
	if err != nil {
		return ""
	}

	parts := strings.Split(filepath.ToSlash(rel), "/")
	if len(parts) == 0 {
		return ""
	}

	return parts[0]
}
