import express from "express";
import multer from "multer";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// my-agent-test A2A 服务器地址
const A2A_SERVER_URL = process.env.A2A_SERVER_URL || "http://localhost:3030";

// 配置 multer 用于文件上传
const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 200 * 1024 * 1024, // 200MB
	},
});

/**
 * 上传用户资产
 * POST /api/user-assets/upload
 */
router.post("/upload", upload.single("file"), async (req, res) => {
	try {
		const { projectId, assetType, description, tags, cloudProvider } =
			req.body;
		const file = req.file;

		if (!file) {
			return res.status(400).json({
				success: false,
				message: "未提供文件",
			});
		}

		if (!projectId || !assetType) {
			return res.status(400).json({
				success: false,
				message: "缺少必要参数: projectId, assetType",
			});
		}

		// 调用 my-agent-test 的 API 上传资产
		const formData = new FormData();
		formData.append("file", file.buffer, {
			filename: file.originalname,
			contentType: file.mimetype,
		});
		formData.append("projectId", projectId);
		formData.append("assetType", assetType);
		formData.append("description", description || "");
		formData.append("tags", tags || "[]");
		formData.append("cloudProvider", cloudProvider || "aliyun");

		const response = await fetch(`${A2A_SERVER_URL}/api/user-assets/upload`, {
			method: "POST",
			body: formData,
			headers: formData.getHeaders(),
		});

		const result = await response.json();

		if (response.ok) {
			res.json(result);
		} else {
			res.status(response.status).json(result);
		}
	} catch (error) {
		console.error("资产上传失败", error);
		res.status(500).json({
			success: false,
			message: error instanceof Error ? error.message : "上传失败",
		});
	}
});

/**
 * 获取项目资产列表
 * GET /api/user-assets?projectId=xxx&agentId=xxx&assetType=xxx
 */
router.get("/", async (req, res) => {
	try {
		const { projectId, agentId, assetType } = req.query;

		if (!projectId) {
			return res.status(400).json({
				success: false,
				message: "缺少参数: projectId",
			});
		}

		// 构建查询参数
		const params = new URLSearchParams();
		params.append("projectId", projectId as string);
		if (agentId) params.append("agentId", agentId as string);
		if (assetType) params.append("assetType", assetType as string);

		// 调用 my-agent-test 的 API
		const response = await fetch(
			`${A2A_SERVER_URL}/api/user-assets?${params.toString()}`
		);

		const result = await response.json();

		if (response.ok) {
			res.json(result);
		} else {
			res.status(response.status).json(result);
		}
	} catch (error) {
		console.error("获取资产列表失败", error);
		res.status(500).json({
			success: false,
			message: error instanceof Error ? error.message : "获取失败",
		});
	}
});

/**
 * 删除资产
 * DELETE /api/user-assets/:assetId
 */
router.delete("/:assetId", async (req, res) => {
	try {
		const { assetId } = req.params;

		// 调用 my-agent-test 的 API
		const response = await fetch(
			`${A2A_SERVER_URL}/api/user-assets/${assetId}`,
			{ method: "DELETE" }
		);

		const result = await response.json();

		if (response.ok) {
			res.json(result);
		} else {
			res.status(response.status).json(result);
		}
	} catch (error) {
		console.error("删除资产失败", error);
		res.status(500).json({
			success: false,
			message: error instanceof Error ? error.message : "删除失败",
		});
	}
});

/**
 * 批量同步资产到云端
 * POST /api/user-assets/sync
 */
router.post("/sync", async (req, res) => {
	try {
		const { projectId, localDir, cloudProvider } = req.body;

		if (!projectId || !localDir) {
			return res.status(400).json({
				success: false,
				message: "缺少必要参数: projectId, localDir",
			});
		}

		// 调用 my-agent-test 的 API
		const response = await fetch(`${A2A_SERVER_URL}/api/user-assets/sync`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				projectId,
				localDir,
				cloudProvider: cloudProvider || "aliyun",
			}),
		});

		const result = await response.json();

		if (response.ok) {
			res.json(result);
		} else {
			res.status(response.status).json(result);
		}
	} catch (error) {
		console.error("资产同步失败", error);
		res.status(500).json({
			success: false,
			message: error instanceof Error ? error.message : "同步失败",
		});
	}
});

export default router;
