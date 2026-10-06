# Pick a 30 s window from a track (starts 4 bars before the first big energy
# rise, on a downbeat) and write beats.json + music.mp3 for promo tasks.
#   uvx --with librosa --python 3.12 python tools/beats.py <track.mp3> <outdir> [secs]
import sys, subprocess
import librosa, numpy as np, json
src, outdir = sys.argv[1], sys.argv[2]; D = float(sys.argv[3]) if len(sys.argv) > 3 else 30.0
y, sr = librosa.load(src, sr=22050)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
on = librosa.onset.onset_strength(y=y, sr=sr); ot = librosa.times_like(on, sr=sr)
rms = librosa.feature.rms(y=y)[0]; rt = librosa.times_like(rms, sr=sr)
st = [np.mean([on[np.argmin(abs(ot-b))] for b in beats[k::4]]) for k in range(4)]
down = beats[int(np.argmax(st))::4]
# start the cut 4 bars before the biggest energy rise, on a downbeat
w = np.array([rms[(rt>=s)&(rt<s+2)].mean() for s in range(0, int(rt[-1])-2, 2)])
rise = 2*int(np.argmax(np.diff(w[:40])))+2
S = float(max(d for d in down if d <= rise - 4*4*60/tempo[0]))
b = [round(float(x-S),3) for x in beats if S <= x < S+D]
db = [round(float(x-S),3) for x in down if S <= x < S+D]
out = {"file":"music.mp3","duration":D,"bpm":round(float(tempo[0]),2),"beats":b,"downbeats":db,
       "drop":round(float(min(db, key=lambda x: abs(x-(rise-S)))),3)}
json.dump(out, open(f"{outdir}/beats.json","w"), indent=1)
subprocess.run(["ffmpeg","-loglevel","error","-y","-ss",str(S),"-t",str(D),"-i",src,"-af",f"afade=t=out:st={D-2}:d=2",
                "-c:a","libmp3lame","-b:a","192k",f"{outdir}/music.mp3"], check=True)
print("S",round(S,3),"rise",rise,out["bpm"],len(b),b[:4],b[-2:],db[:4],"drop",out["drop"])
