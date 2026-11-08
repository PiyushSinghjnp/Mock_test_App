# Question Paper Sources

JSON files in this directory are static source files; placing a file here does not import it into the application database.

To add or update a paper, use the administrator page's JSON upload workflow. It validates the paper and stores the normalized test in PostgreSQL. The application does not use a local SQLite database.

Legacy SQLite import and maintenance scripts are retained only for explicitly requested archival migration work; they are not part of application startup or routine development.
