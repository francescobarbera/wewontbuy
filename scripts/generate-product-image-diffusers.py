#!/usr/bin/env python3
import argparse
import sys


def parse_size(value):
    try:
        width, height = value.lower().split("x", 1)
        return int(width), int(height)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("--size must look like 1024x1024") from exc


def main():
    parser = argparse.ArgumentParser(description="Generate one product image with Hugging Face Diffusers.")
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--negative-prompt", default="")
    parser.add_argument("--output", required=True)
    parser.add_argument("--model", default="stabilityai/sdxl-turbo")
    parser.add_argument("--variant", default="")
    parser.add_argument("--size", type=parse_size, default=(1024, 1024))
    parser.add_argument("--steps", type=int, default=4)
    parser.add_argument("--guidance", type=float, default=0)
    parser.add_argument("--seed", type=int, default=1)
    args = parser.parse_args()

    try:
        import torch
        from diffusers import AutoPipelineForText2Image
    except ModuleNotFoundError as exc:
        missing = exc.name or "required Python dependency"
        print(
            f"{missing} is not installed. Run `npm run setup:images` and then retry with "
            "`--image-python .venv-images/bin/python`.",
            file=sys.stderr,
        )
        return 2

    width, height = args.size
    use_cuda = torch.cuda.is_available()
    device = "cuda" if use_cuda else "cpu"
    dtype = torch.float16 if use_cuda else torch.float32

    load_options = {
        "torch_dtype": dtype,
        "use_safetensors": True,
    }
    if args.variant:
        load_options["variant"] = args.variant

    pipe = AutoPipelineForText2Image.from_pretrained(args.model, **load_options)
    pipe.to(device)
    if hasattr(pipe, "enable_attention_slicing"):
        pipe.enable_attention_slicing()

    generator = torch.Generator(device=device).manual_seed(args.seed)
    image = pipe(
        prompt=args.prompt,
        negative_prompt=args.negative_prompt,
        width=width,
        height=height,
        num_inference_steps=args.steps,
        guidance_scale=args.guidance,
        generator=generator,
    ).images[0]
    image.save(args.output)
    print(args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
