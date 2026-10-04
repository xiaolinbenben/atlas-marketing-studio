---
name: prod-ssh
description: >
  Read-only SSH troubleshooting for the terln-studio production server
  at root@216.167.70.247 using the existing local key ~/.ssh/id_ed25519.
  Never prints passwords or key material, and never creates, changes, or
  deletes anything on the server. Use when the user says 生产排障, 看线上日志,
  登录服务器, 线上只读, prod ssh, or runs /prod-ssh.
---

# 生产只读排障

只通过这个脚本连接生产机：

`.agents/skills/prod-ssh/scripts/ro-ssh.sh`

目标是 `root@216.167.70.247`。私钥用本机已有的 `~/.ssh/id_ed25519`。公钥已经在服务器上。不要新建密钥，不要执行 `ssh-copy-id`，不要使用密码、`sshpass` 或 `DEPLOY_PASSWORD`。登录失败就停下说明原因。

不要裸跑 `ssh`。脚本拒绝命令后，不要改用 shell、解释器或重定向再试。需要写入、删除、新增、重启或发布时，只说明建议，然后停止。

`ssh terln-prod` 只给人工登录。配置在 `~/.ssh/config`。不要把密码写进这个文件。配置丢失时，按下面这段补回，不要改主机和密钥：

```
Host terln-prod
  HostName 216.167.70.247
  User root
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
  PreferredAuthentications publickey
  PasswordAuthentication no
  BatchMode yes
```

## 排障

按这个顺序，每条都交给脚本：

1. `whoami`
2. `docker ps`
3. `docker compose -f /opt/terln-studio/deploy/docker-compose.yml ps`
4. `curl -fsS --max-time 5 http://127.0.0.1:3000/api/health`
5. `df -h`
6. `free -h`
7. `docker stats --no-stream`
8. `docker compose -f /opt/terln-studio/deploy/docker-compose.yml logs --tail 200 app`

查库时先 `docker volume inspect terln-studio_atlas-data`，再用它的挂载点：

`sqlite3 file:<挂载点>/atlas.db?mode=ro .tables`

只读语句限于 `SELECT`、`PRAGMA`、`EXPLAIN`、`WITH`，以及 `.tables`、`.schema`、`.indexes`、`.databases`。设置只查配置名，不查密钥值。

允许和拒绝的命令以 `scripts/ro-ssh.sh` 为准。脚本会把输出里的密钥样值换成 `[redacted]`。不要把这些值补回去，也不要读取 `.env`、私钥或 `authorized_keys`。
