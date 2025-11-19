import express from "express";

const router = express.Router();

// my-agent-test A2A 服务器地址
const A2A_SERVER_URL = process.env.A2A_SERVER_URL || "http://localhost:3030";

/**
 * 获取所有 Agent 配置
 * GET /api/agents/configs
 */
router.get("/configs", async (req, res) => {
	try {
		// 返回默认配置（也可以从 my-agent-test 获取）
		const configs = [
			{
				agentId: "planning-agent",
				name: "策划 Agent",
				type: "planning",
				provider: "deepseek",
				model: "deepseek-r1",
				systemPrompt:
					"你是一位资深的游戏策划专家，擅长设计各类游戏的核心玩法和系统架构。",
				supportedAssetTypes: ["planning_doc"],
			},
			{
				agentId: "art-agent",
				name: "美术 Agent",
				type: "art",
				provider: "meshy",
				model: "meshy-4",
				systemPrompt:
					"你是一位专业的游戏美术设计师，擅长创建各种游戏资源。",
				supportedAssetTypes: [
					"art_concept",
					"art_texture",
					"art_model",
					"art_animation",
				],
			},
			{
				agentId: "music-agent",
				name: "音乐 Agent",
				type: "music",
				provider: "openai",
				model: "gpt-4o",
				systemPrompt:
					"你是一位专业的游戏音频设计师，擅长创作游戏背景音乐和音效。",
				supportedAssetTypes: ["audio_music", "audio_sfx"],
			},
			{
				agentId: "tech-agent",
				name: "技术 Agent",
				type: "tech",
				provider: "anthropic",
				model: "claude-sonnet-4.5",
				systemPrompt:
					"你是一位资深的游戏开发工程师，精通各种游戏引擎和编程语言。",
				supportedAssetTypes: ["code_source", "code_asset"],
			},
			{
				agentId: "test-agent",
				name: "测试 Agent",
				type: "test",
				provider: "anthropic",
				model: "claude-sonnet-4.5",
				systemPrompt:
					"你是一位专业的游戏QA测试工程师，擅长自动化测试和问题分析。",
				supportedAssetTypes: [],
			},
		];

		res.json({
			success: true,
			data: configs,
		});
	} catch (error) {
		console.error("获取 Agent 配置失败", error);
		res.status(500).json({
			success: false,
			message: error instanceof Error ? error.message : "获取失败",
		});
	}
});

/**
 * 测试单个 Agent
 * POST /api/agents/test
 */
router.post("/test", async (req, res) => {
	try {
		const {
			agentId,
			userRequirement,
			modelConfig,
			useUserAssets,
			useMCPIntegration,
			projectId,
		} = req.body;

		if (!agentId || !userRequirement) {
			return res.status(400).json({
				success: false,
				message: "缺少必要参数: agentId, userRequirement",
			});
		}

		// 这里调用 my-agent-test 的 Agent 预览功能
		// 简化版实现，实际应该通过 HTTP 调用 my-agent-test 的 API
		const result = {
			agentId,
			status: "completed",
			artifact: {
				artifactId: `test-${Date.now()}`,
				type: getArtifactType(agentId),
				url: `https://example.com/artifacts/${Date.now()}`,
				content: {
					message: "这是模拟的测试结果",
					requirement: userRequirement,
					modelUsed: modelConfig?.model || "default",
					usedUserAssets: useUserAssets || false,
					usedMCP: useMCPIntegration || false,
				},
			},
			metadata: {
				provider: modelConfig?.provider,
				model: modelConfig?.model,
				executionTime: Math.random() * 10 + 5,
				timestamp: new Date().toISOString(),
			},
			logs: [
				`[${new Date().toISOString()}] 开始执行 Agent: ${agentId}`,
				`[${new Date().toISOString()}] 使用模型: ${modelConfig?.model || "default"}`,
				`[${new Date().toISOString()}] 处理用户需求: ${userRequirement}`,
				useUserAssets &&
					`[${new Date().toISOString()}] 加载用户素材: ${projectId}`,
				useMCPIntegration &&
					`[${new Date().toISOString()}] 连接 MCP 本地工具`,
				`[${new Date().toISOString()}] 生成结果完成`,
			].filter(Boolean),
		};

		// 模拟延迟
		await new Promise((resolve) => setTimeout(resolve, 2000));

		res.json({
			success: true,
			data: result,
		});
	} catch (error) {
		console.error("Agent 测试失败", error);
		res.status(500).json({
			success: false,
			message: error instanceof Error ? error.message : "测试失败",
		});
	}
});

/**
 * 更新 Agent 模型配置
 * PUT /api/agents/:agentId/config
 */
router.put("/:agentId/config", async (req, res) => {
	try {
		const { agentId } = req.params;
		const { provider, model, systemPrompt, extra } = req.body;

		// 这里应该更新配置文件或数据库
		// 简化实现，只返回成功

		res.json({
			success: true,
			message: "配置更新成功",
			data: {
				agentId,
				provider,
				model,
				systemPrompt,
				extra,
			},
		});
	} catch (error) {
		console.error("更新 Agent 配置失败", error);
		res.status(500).json({
			success: false,
			message: error instanceof Error ? error.message : "更新失败",
		});
	}
});

// 辅助函数
function getAgentName(type: string): string {
	const names: Record<string, string> = {
		planning: "策划 Agent",
		art: "美术 Agent",
		music: "音乐 Agent",
		tech: "技术 Agent",
		test: "测试 Agent",
	};
	return names[type] || type;
}

function getSupportedAssetTypes(type: string): string[] {
	const mapping: Record<string, string[]> = {
		planning: ["planning_doc"],
		art: ["art_concept", "art_texture", "art_model", "art_animation"],
		music: ["audio_music", "audio_sfx"],
		tech: ["code_source", "code_asset"],
		test: [],
	};
	return mapping[type] || [];
}

function getArtifactType(agentId: string): string {
	if (agentId.includes("planning")) return "gdd";
	if (agentId.includes("art")) return "image";
	if (agentId.includes("music")) return "audio";
	if (agentId.includes("tech")) return "code";
	if (agentId.includes("test")) return "test-report";
	return "unknown";
}

export default router;
