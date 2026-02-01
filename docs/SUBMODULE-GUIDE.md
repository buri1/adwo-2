# Git Submodule Guide für ADWO 2.0

## Was ist ein Submodule?

Ein Submodule ist **ein Pointer auf einen spezifischen Commit** in einem anderen Repo - NICHT ein Live-Link.

```
adwo-2/
├── orchestrator/  ← "Zeigt auf Commit abc123 von orchestrator-template"
└── ...
```

## Wichtig zu verstehen

| Aktion | Was passiert |
|--------|--------------|
| Du pushst zu `orchestrator-template` | `adwo-2` merkt davon **NICHTS** automatisch |
| Du klonst `adwo-2` | Du bekommst den gepinnten Stand des Submodules |
| Du willst neueste Orchestrator-Version | Du musst explizit updaten |

**Goldene Regel:** Submodules aktualisieren sich NIE automatisch. Das ist ein Feature, kein Bug (Stabilität).

---

## Die 3 wichtigsten Workflows

### 1. Repo klonen (einmalig)

```bash
# Option A: Beim Klonen direkt Submodules holen
git clone --recurse-submodules https://github.com/buri1/adwo-2

# Option B: Nachträglich initialisieren
git clone https://github.com/buri1/adwo-2
cd adwo-2
git submodule update --init --recursive
```

### 2. Orchestrator auf neueste Version updaten

Wenn `orchestrator-template` neue Commits hat und du diese in `adwo-2` haben willst:

```bash
cd adwo-2

# Hole neuesten Stand des Submodules
git submodule update --remote orchestrator

# Jetzt zeigt adwo-2 auf den neuen Commit - aber noch nicht committed!
git status
# > modified: orchestrator (new commits)

# Commit die Änderung
git add orchestrator
git commit -m "chore: update orchestrator to latest"
git push
```

### 3. Im Orchestrator arbeiten (Änderungen am Orchestrator selbst)

Wenn du den Orchestrator verbessern willst:

```bash
cd adwo-2/orchestrator

# Du bist jetzt IM orchestrator-template Repo!
# Mache deine Änderungen...

git add .
git commit -m "feat: add new feature"
git push  # ← Pusht zu github.com/buri1/orchestrator-template!

# Zurück zum Parent-Repo
cd ..

# adwo-2 muss den neuen Submodule-Stand auch committen
git add orchestrator
git commit -m "chore: update orchestrator submodule ref"
git push  # ← Pusht zu github.com/buri1/adwo-2
```

**Merke:** Änderungen im Submodule = **2 Commits** (einer im Submodule, einer im Parent)

---

## Visualisierung

```
orchestrator-template (GitHub)
    │
    ├── Commit A ← adwo-2 zeigt hierauf (gepinnt)
    ├── Commit B
    └── Commit C ← HEAD (neuester Stand)
```

Nach `git submodule update --remote`:

```
orchestrator-template (GitHub)
    │
    ├── Commit A
    ├── Commit B
    └── Commit C ← adwo-2 zeigt jetzt hierauf (nach commit+push)
```

---

## Häufige Probleme & Lösungen

### Problem: Submodule-Ordner ist leer nach Clone

```bash
git submodule update --init --recursive
```

### Problem: "HEAD detached" im Submodule

Das ist normal! Submodules sind immer auf einen spezifischen Commit gepinnt.

```bash
cd orchestrator
git checkout main  # Wenn du auf dem neuesten Stand arbeiten willst
# Aber Achtung: Danach musst du im Parent-Repo den neuen Stand committen!
```

### Problem: Merge-Konflikte im Submodule-Pointer

```bash
# Im Parent-Repo
git checkout --theirs orchestrator  # Oder --ours, je nach Wunsch
git add orchestrator
git commit
```

---

## Quick Reference

| Was du willst | Command |
|---------------|---------|
| Klonen mit Submodules | `git clone --recurse-submodules <url>` |
| Submodules nachträglich holen | `git submodule update --init --recursive` |
| Auf neueste Version updaten | `git submodule update --remote <name>` |
| Status aller Submodules | `git submodule status` |
| Alle Submodules updaten | `git submodule foreach git pull origin main` |

---

## Warum Submodules für ADWO?

1. **Orchestrator bleibt unabhängig** - Andere Projekte können ihn standalone nutzen
2. **Versionierung** - ADWO kann eine spezifische Orchestrator-Version pinnen
3. **Getrennte Entwicklung** - Orchestrator-Verbesserungen müssen nicht durch ADWO gehen
4. **Stabilität** - ADWO bricht nicht wenn Orchestrator sich ändert
