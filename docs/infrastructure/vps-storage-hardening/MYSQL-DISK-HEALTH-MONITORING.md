# MySQL Disk Health Monitoring

The read-only monitor collects container health, uptime/start time, restart
count, current connections, long transactions, metadata locks, InnoDB
transactions, redo/binlog/data size, temporary-table counters, and recent
disk-full, redo, I/O, and connection errors.

It does not kill ordinary business queries. A transaction may enter a controlled
termination review only when it is deployment-created, attributable, stale
beyond the approved limit, and dependency-checked.

Baseline: healthy, restart count 23, data volume 611,459,072 bytes, binlogs
213,430,605 bytes, redo 104,857,600 bytes. Current observation sample remains
healthy with no lock holder and no new disk-related restart.

