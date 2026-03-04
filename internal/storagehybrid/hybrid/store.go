package hybrid

import (
	"database/sql"
	"fmt"

	"github.com/brandon-fryslie/cc-viz/internal/storagehybrid/canonical"
	"github.com/brandon-fryslie/cc-viz/internal/storagehybrid/searchsql"
)

type Store struct {
	Canonical *canonical.Store
	Search    *searchsql.Store
}

func New(sqlDB *sql.DB) (*Store, error) {
	canonicalStore, err := canonical.NewWithSQLDB(sqlDB)
	if err != nil {
		return nil, err
	}

	return &Store{
		Canonical: canonicalStore,
		Search:    searchsql.New(sqlDB),
	}, nil
}

func (s *Store) Bootstrap() error {
	if err := s.Canonical.Migrate(); err != nil {
		return fmt.Errorf("canonical migrate: %w", err)
	}
	if err := s.Search.EnsureFTS5(); err != nil {
		return fmt.Errorf("search bootstrap: %w", err)
	}
	return nil
}
