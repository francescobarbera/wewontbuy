#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${WE_DONT_BUY_IMAGE_CONTAINER:-we-dont-buy-images:latest}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HF_CACHE="${HF_HOME:-$HOME/.cache/huggingface}"
GPU_MODE="${WE_DONT_BUY_DOCKER_GPU_MODE:-auto}"

mkdir -p "$HF_CACHE"

docker_gpu_args() {
  if [[ "$GPU_MODE" == "nvidia" ]]; then
    printf '%s\n' "--gpus" "all"
    return
  fi

  if [[ "$GPU_MODE" == "auto" ]] && command -v nvidia-container-cli >/dev/null 2>&1; then
    printf '%s\n' "--gpus" "all"
    return
  fi

  local driver_version
  driver_version="$(nvidia-smi --query-gpu=driver_version --format=csv,noheader | head -n 1)"
  local lib_dir="/usr/lib"
  local container_lib_dir="/usr/lib/x86_64-linux-gnu"
  local args=(
    "--device" "/dev/nvidia0"
    "--device" "/dev/nvidiactl"
    "--device" "/dev/nvidia-uvm"
    "--device" "/dev/nvidia-uvm-tools"
    "-v" "/usr/bin/nvidia-smi:/usr/bin/nvidia-smi:ro"
    "-v" "$lib_dir/libcuda.so.$driver_version:$container_lib_dir/libcuda.so.1:ro"
    "-v" "$lib_dir/libcuda.so.$driver_version:$container_lib_dir/libcuda.so:ro"
    "-v" "$lib_dir/libnvidia-ml.so.$driver_version:$container_lib_dir/libnvidia-ml.so.1:ro"
    "-v" "$lib_dir/libnvidia-ml.so.$driver_version:$container_lib_dir/libnvidia-ml.so:ro"
    "-v" "$lib_dir/libnvidia-ptxjitcompiler.so.$driver_version:$container_lib_dir/libnvidia-ptxjitcompiler.so.1:ro"
    "-v" "$lib_dir/libnvidia-ptxjitcompiler.so.$driver_version:$container_lib_dir/libnvidia-ptxjitcompiler.so:ro"
    "-v" "$lib_dir/libnvidia-nvvm.so.$driver_version:$container_lib_dir/libnvidia-nvvm.so.4:ro"
    "-v" "$lib_dir/libnvidia-nvvm.so.$driver_version:$container_lib_dir/libnvidia-nvvm.so:ro"
    "-e" "LD_LIBRARY_PATH=$container_lib_dir"
  )
  printf '%s\n' "${args[@]}"
}

mapfile -t gpu_args < <(docker_gpu_args)

exec docker run --rm \
  "${gpu_args[@]}" \
  --ipc=host \
  -e HF_HOME=/cache/huggingface \
  -v "$PROJECT_ROOT:$PROJECT_ROOT" \
  -v "$HF_CACHE:/cache/huggingface" \
  -w "$PROJECT_ROOT" \
  "$IMAGE_NAME" \
  python "$@"
