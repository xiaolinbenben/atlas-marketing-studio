/** Seedance 2.0 model IDs shipped by the provider. Keep these in code. */
export const SEEDANCE_MODELS = {
  standard: {
    imageToVideo: 'bytedance/seedance-2.0/image-to-video',
    referenceToVideo: 'bytedance/seedance-2.0/reference-to-video',
    textToVideo: 'bytedance/seedance-2.0/text-to-video',
  },
  fast: {
    imageToVideo: 'bytedance/seedance-2.0-fast/image-to-video',
    referenceToVideo: 'bytedance/seedance-2.0-fast/reference-to-video',
    textToVideo: 'bytedance/seedance-2.0-fast/text-to-video',
  },
} as const;

export type SeedanceVariant = keyof typeof SEEDANCE_MODELS;
export type SeedanceInput = keyof typeof SEEDANCE_MODELS.standard;

export const SEEDANCE_VARIANTS: readonly { key: SeedanceVariant; label: string }[] = [
  { key: 'standard', label: 'Seedance 2.0（普通）' },
  { key: 'fast', label: 'Seedance 2.0 Fast（快速）' },
];

export const SEEDANCE_VIDEO_MODELS = Object.values(SEEDANCE_MODELS).flatMap((models) => Object.values(models));

export const SEEDANCE_RESOLUTIONS: Record<SeedanceVariant, readonly string[]> = {
  standard: ['480p', '720p', '1080p', '720p-SR', '1080p-SR', '1440p-SR', '4k'],
  fast: ['480p', '720p', '720p-SR', '1080p-SR', '1440p-SR'],
};

export function isSeedanceVideoModel(value: unknown): value is string {
  return typeof value === 'string' && (SEEDANCE_VIDEO_MODELS as readonly string[]).includes(value);
}

export function seedanceModel(input: SeedanceInput, variant: unknown): string {
  const key: SeedanceVariant = variant === 'fast' ? 'fast' : 'standard';
  return SEEDANCE_MODELS[key][input];
}

export function seedanceVariantForModel(model: string): SeedanceVariant {
  return model.includes('seedance-2.0-fast') ? 'fast' : 'standard';
}

/** Seedance 2.0 accepts an integer from 4 to 15, or -1. */
export function seedanceDuration(value: unknown): number {
  const n = Number(value);
  if (n === -1) return -1;
  if (!Number.isFinite(n) || n <= 0) return 15;
  return Math.min(15, Math.max(4, Math.round(n)));
}

const ARK_ERROR_ZH: Record<string, string> = {
  MissingParameter: '请求缺少必要参数，请查阅 API 文档。',
  InvalidParameter: '请求包含非法参数，请查阅 API 文档。',
  'InvalidEndpoint.ClosedEndpoint': '推理接入点处于已被关闭或暂时不可用，请稍后重试，或联系推理接入点管理员。',
  SensitiveContentDetected: '输入文本可能包含敏感信息，请您使用其他 prompt。',
  'SensitiveContentDetected.SevereViolation': '输入文本可能包含严重违规相关信息，请您使用其他 prompt',
  'SensitiveContentDetected.Violence': '输入文本可能包含激进行为相关信息，请您使用其他 prompt',
  InputTextSensitiveContentDetected: '输入文本可能包含敏感信息，请您更换后重试。',
  InputImageSensitiveContentDetected: '输入图像可能包含敏感信息，请您更换后重试。',
  InputVideoSensitiveContentDetected: '输入视频可能包含敏感信息，请您更换后重试。',
  InputAudioSensitiveContentDetected: '输入音频可能包含敏感信息，请您更换后重试',
  OutputTextSensitiveContentDetected: '生成的文字可能包含敏感信息，请您更换输入内容后重试',
  OutputImageSensitiveContentDetected: '生成的图像可能包含敏感信息，请您更换输入内容后重试。',
  OutputVideoSensitiveContentDetected: '生成的视频可能包含敏感信息，请您更换输入内容后重试。',
  OutputAudioSensitiveContentDetected: '生成的音频可能包含敏感信息，请您更换输入内容后重试。',
  'InputTextSensitiveContentDetected.PolicyViolation': '输入文本可能涉及版权限制，请您更换后重试。',
  'InputImageSensitiveContentDetected.PolicyViolation': '输入图片可能涉及版权限制，请您更换后重试。',
  'InputVideoSensitiveContentDetected.PolicyViolation': '输入视频可能涉及版权限制，请您更换后重试。',
  'InputAudioSensitiveContentDetected.PolicyViolation': '输入音频可能涉及版权限制，请您更换后重试。',
  'OutputVideoSensitiveContentDetected.PolicyViolation': '生成的视频可能涉及版权限制，请您更换输入内容后重试。',
  'OutputAudioSensitiveContentDetected.PolicyViolation': '生成的音频可能涉及版权限制，请您更换输入内容后重试。',
  'InputImageSensitiveContentDetected.PrivacyInformation': '输入图片可能包含真人，请您更换后重试。',
  'InputVideoSensitiveContentDetected.PrivacyInformation': '输入视频可能包含真人，请您更换后重试。',
  'OutputImageSensitiveContentDetected.DeepFake': '输出图片可能涉及伪造内容风险，请您更换后重试。',
  InputTextRiskDetection: '火山引擎风险识别产品检测到输入文本可能包含敏感信息，请您更换后重试。',
  InputImageRiskDetection: '火山引擎风险识别产品检测到输入图片可能包含敏感信息，请您更换后重试。',
  OutputTextRiskDetection: '火山引擎风险识别产品检测到输出文本可能包含敏感信息，请您更换后重试。',
  OutputImageRiskDetection: '火山引擎风险识别产品检测到输出图片可能包含敏感信息，请您更换后重试。',
  ContentSecurityDetectionError: '火山引擎风险识别产品请求失败。',
  'InvalidParameter.': '请求参数值不合法。请检查参数值的正确性后重试。',
  'InvalidParameter.TaskTypeConstraint': '请求参数与模型判定的任务类型不兼容，请根据 Issues 提示修改对应参数后重试。',
  'InvalidParameter.TaskTypeMismatch': '模型识别的任务类型与指定值不一致。请调整提示词和输入素材后重试。',
  'MissingParameter.': '缺少必要的请求参数。请确认请求参数后重试。',
  'Duplicate.Tags.Key': '对象的标签存在重复Key。',
  InvalidArgumentError: '请求中的 messages 列表里，有消息体缺少 role 字段',
  'InvalidArgumentError.UnknownRole': '消息体中的 role 值不被支持，如user_。',
  'InvalidArgumentError.InvalidImageDetail': 'image_url 中的 detail 参数值无效，只接受 "auto", "high", "low"',
  'InvalidArgumentError.InvalidPixelLimit': '用户自定义的图片像素限制（min_pixels, max_pixels）无效（例如 min_pixels > max_pixels，或超出了服务配置的范围）',
  'InvalidImageURL.EmptyURL': '传入的图片 URL 为空',
  'InvalidImageURL.InvalidFormat': '无法解析或处理图片，可能是 Base64 格式不正确、图片数据损坏或格式不支持',
  OutofContextError: '当请求中包含图片时，文本和图片编码后的总 token 数超过了模型上下文长度限制',
  'InvalidParameter.UnsupportedParameter': '传入的参数在此推理接入点不可用。',
  'InvalidParameter.TosURLInvalid': 'TOS URI不合法。',
  InvalidSubscription: 'Coding Plan 套餐未订阅或已过期。',
  AuthenticationError: '请求携带的 API Key 或 AK/SK 校验未通过，请您重新检查设置的鉴权凭证，或者查看 API 调用文档来排查问题。',
  InvalidAccountStatus: '当前使用的账号异常。',
  'OperationDenied.InvalidState': '请求所关联的Context ID处于非空闲状态，不可调用。',
  'OperationDenied.ConflictedValidationSet': '无法同时上传验证集和设置训练集取样为验证集百分比，不支持该操作。',
  'OperationDenied.PermissionDenied': '您没有权限访问基础模型的配置，不支持该操作。',
  'OperationDenied.UnsupportedCustomizationType': '模型不支持该训练方法，不支持该操作。',
  'OperationDenied.CustomizationNotSupported': '基础模型的版本不支持该训练方法，不支持该操作。',
  'OperationDenied.ServiceNotOpen': '模型服务不可用，不支持该操作。请前往火山方舟控制台激活模型服务，或提交工单联系我们。',
  'OperationDenied.ServiceOverdue': '您的账单已逾期，不支持该操作。请前往火山费用中心充值。',
  AccountOverdueError: '当前账号欠费（余额<0），如需继续调用，请前往火山引擎费用中心进行充值。',
  AccessDenied: '没有访问该资源的权限，请检查权限设置，或联系管理员添加白名单。',
  'OperationDenied.UnsupportedPhase': '操作失败，操作目标在特殊状态，请检查目标是否存在或者被锁定等特殊状态中。',
  'OperationDenied.FileQuotaExceeded': '当前账号已耗尽文件存储额度，如需继续使用，请删除历史文件。',
  'OperationDenied.ArkAccessRoleNotFound': '请到方舟项目配置-项目授权，对tos资源授权后再进行操作。',
  'OperationDenied.TosAccessDenied': '无权访问 TOS 资源，请确认您的账户 / 项目对该 bucket 拥有访问权限。',
  'QuotaExceeded.DoubaoSearchFreeQuotaExceeded': '豆包搜索的免费额度已耗尽。',
  'InvalidEndpointOrModel.NotFound': '模型或者推理接入点不存在或者您无权访问它。',
  ModelNotOpen: '当前账号暂未开通该模型服务，请前往火山方舟控制台开通管理页开通对应模型服务。',
  'NotFound.': '指定资源找不到。请确认参数后重试。',
  'InvalidEndpointOrModel.ModelIDAccessDisabled': '未能找到指定的模型ID。你的账号不允许使用模型ID来调用模型，请确认你账号权限或者使用有权限的推理接入点 ID 来调用模型服务。',
  UnsupportedModel: '当前模型不支持 Coding Plan。',
  'RateLimitExceeded.EndpointRPMExceeded': '请求所关联的推理接入点已超过 RPM (Requests Per Minute) 限制, 请稍后重试。',
  'RateLimitExceeded.EndpointTPMExceeded': '请求所关联的推理接入点已超过 TPM (Tokens Per Minute) 限制, 请稍后重试。',
  'RateLimitExceeded.EndpointFlexTPMExceeded': '已超过推理接入点配置的 Flex TPM 上限。请在客户端退避重试，或调整推理接入点的 Flex TPM 配置。',
  ModelAccountRpmRateLimitExceeded: '请求已超过帐户模型 RPM (Requests Per Minute) 限制: 请您稍后重试, 或者联系平台技术同学进行解决',
  ModelAccountTpmRateLimitExceeded: '请求已超过帐户模型 TPM (Tokens Per Minute) 限制: 请您稍后重试, 或者联系平台技术同学进行解决',
  ModelAccountFlexTpmRateLimitExceeded: '已超过账号 × 模型的 Flex TPM 上限。请在客户端退避重试，或申请提升 Flex TPM 配额，或将任务迁移到闲时段。',
  APIAccountRpmRateLimitExceeded: '当前账号该接口的RPM (Requests Per Minute)限制已超出，请稍后重试。',
  ModelAccountIpmRateLimitExceeded: '请求已超过账户模型 IPM (Images Per Minute) 限制: 请您稍后重试, 或者联系平台技术同学进行解决',
  QuotaExceeded: '当前账号处于排队中状态的任务数已超过限制，请稍后重试。',
  ServerOverloaded: '服务资源紧张，请您稍后重试。常出现在调用流量突增或刚开始调用长时间未使用的推理接入点。',
  RequestBurstTooFast: '请求量激增触发系统保护，请放缓流量提升速度，逐步增加请求量后再尝试',
  SetLimitExceeded: '当前账号已达到设置的模型用量上限值，如需继续调用，请前往火山方舟控制台开通管理页修改模型用量上限值或关闭安心体验模式。',
  InflightBatchsizeExceeded: '您已经达到当前充值金额下的最大并发数限制，您可以充值解锁更大并发额度或降低并发数。',
  AccountRateLimitExceeded: '请求超出RPM / TPM限制。',
  'QuotaExceeded.AgentPlanQuotaExceeded': 'Agent Plan 套餐的 AFP 已耗尽。',
  InternalServiceError: '内部系统异常，请您稍后重试。',
};

const ARK_ERROR_CODES = Object.keys(ARK_ERROR_ZH).sort((a, b) => b.length - a.length);

function arkErrorCode(value: unknown, depth = 0): string {
  if (depth > 3 || value == null) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    let parsed: unknown;
    if (trimmed.startsWith('{')) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = undefined;
      }
    }
    if (parsed !== undefined) {
      const nested = arkErrorCode(parsed, depth + 1);
      if (nested) return nested;
    }
    return ARK_ERROR_CODES.find((item) => trimmed.includes(item)) || '';
  }
  if (typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  if (typeof record.code === 'string' && ARK_ERROR_ZH[record.code]) return record.code;
  if (record.error != null && record.error !== value) {
    const nested = arkErrorCode(record.error, depth + 1);
    if (nested) return nested;
  }
  return '';
}

export function arkUserError(value: unknown): string {
  const code = arkErrorCode(value);
  return code ? ARK_ERROR_ZH[code] : '';
}
