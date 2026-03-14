RunPod quick start for Meyram AI

This folder is local-only. It is not pushed to GitHub.

What this gives you
- A simple bootstrap for a RunPod GPU pod
- Ollama + Qwen3 startup on port 11434
- A helper script to switch the Cloudflare Worker from Groq to Ollama
- A single paste-ready bootstrap file for the RunPod terminal

Recommended first step
- Start with chat only on RunPod
- Keep STT on Groq for now
- Add FasterLivePortrait after the pod is stable

Suggested cheap pod settings
- GPU: RTX 4090
- Container Disk: 50 GB
- Volume Disk: 50 GB
- Jupyter notebook: on
- SSH terminal access: off
- Pricing: On-Demand

Why RunPod asks for money
- Pods are prepaid
- If you are testing, avoid large top-ups
- Use the smallest custom amount the checkout allows

Fastest way once the pod is up
1. Open the local file below on your Windows machine:

```text
E:\Проект в гитхабе\local-worker\runpod\runpod-paste-bootstrap.sh
```

2. Copy its full contents.
3. Open the RunPod terminal in Jupyter.
4. Paste the whole script and press Enter.

It will:
- install base packages
- install Ollama
- start Ollama on port 11434
- pull qwen3.5:27b
- run a smoke test

Alternative file-by-file flow
- bootstrap-base.sh
- bootstrap-ollama-qwen.sh

Test Ollama after startup

```bash
curl http://127.0.0.1:11434/api/tags
curl http://127.0.0.1:11434/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen3.5:27b","messages":[{"role":"user","content":"Salem, kazaksha jauap ber."}],"stream":false}'
```

After that find your public RunPod proxy URL for port 11434:

```text
https://YOUR-POD-ID-11434.proxy.runpod.net
```

Back on your Windows machine
1. Open:

```text
E:\Проект в гитхабе\local-worker
```

2. Run:

```powershell
.\runpod\switch-worker-to-ollama.ps1 -OllamaBaseUrl "https://YOUR-POD-ID-11434.proxy.runpod.net"
```

3. Redeploy the Worker:

```powershell
.\deploy.ps1
```

What the switch script changes
- CHAT_PROVIDER=ollama
- OLLAMA_BASE_URL=your RunPod URL
- OLLAMA_CHAT_MODEL=qwen3.5:27b

What it does not change yet
- STT stays on Groq
- TTS stays as-is
- Avatar stays on placeholder URLs until FasterLivePortrait is installed