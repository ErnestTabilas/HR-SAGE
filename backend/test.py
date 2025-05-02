import os
from supabase import create_client, Client

# read from env
SUPABASE_URL       = os.environ["SUPABASE_URL"]
SERVICE_ROLE_KEY   = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# initialize
supabase: Client = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

def main():
    # 1️⃣ insert a row
    ins = {"foo": "hello world", "bar": 123}
    resp = supabase.table("test_table").insert(ins).execute()
    print("Insert response:", resp)

    # 2️⃣ select back up to 5 rows
    resp = supabase.table("test_table").select("*").limit(5).execute()
    print("Select response:", resp)

if __name__ == "__main__":
    main()
