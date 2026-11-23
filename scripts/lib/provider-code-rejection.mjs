// A network/server/rate-limit error is not evidence of OTP invalidation.
export function providerCodeRejected(result){
 return result?.error?.status===403&&result.error.code==='otp_expired'&&!result.data?.user&&!result.data?.session;
}
