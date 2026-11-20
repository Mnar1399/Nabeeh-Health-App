
from database.db import get_connection

def add_summary_columns():
    connection = get_connection()

    try:
        existing_columns = [
            row["name"]
            for row in connection.execute(
                "PRAGMA table_info(articles)"
            ).fetchall()
        ]

        new_columns = {
            "summary": "TEXT",
            "key_points": "TEXT",
            "summary_status": "TEXT DEFAULT 'pending'",
            "summary_updated_at": "TEXT"
        }

        for column_name, column_type in new_columns.items():
            if column_name not in existing_columns:
                connection.execute(
                    f"ALTER TABLE articles ADD COLUMN {column_name} {column_type}"
                )
                print(f"Added column: {column_name}")
            else:
                print(f"Already exists: {column_name}")

        connection.commit()
        print("\nDatabase is ready for AI summaries!")

    finally:
        connection.close()


if __name__ == "__main__":
    add_summary_columns()
