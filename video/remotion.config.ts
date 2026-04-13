import { Config } from "@remotion/cli/config";

Config.setEntryPoint("./src/index.tsx");
Config.setCodec("h264");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
