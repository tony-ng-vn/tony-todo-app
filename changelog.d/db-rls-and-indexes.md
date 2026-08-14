**Backend**

- Row security checks now evaluate once per query instead of once per row, and the hottest table dropped eight dead indexes from the pre-account era, so reads and writes stay fast as history grows.
- Dismissed history and the remaining foreign keys got covering indexes ahead of data growth.
