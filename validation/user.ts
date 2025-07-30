import Joi from "joi";

const isDev = process.env.NODE_ENV === 'development';

export const registerSchema = Joi.object({
  name: Joi.string().min(3).max(30).required(),
  email: isDev 
    ? Joi.string().email().required() // Any valid email in dev
    : Joi.string().email().pattern(/@in\.gt\.com$/).required() // Only @in.gt.com in prod
      .messages({
        'string.pattern.base': 'Email must use the @in.gt.com domain'
      }),
  mobile: Joi.string().min(10),
  department: Joi.string().required().label("Department"),
  role: Joi.string().required().label("Role"),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  // password: Joi.string().min(8).required(),
});

export const microsoftLoginSchema = Joi.object({
  token: Joi.string().required()
});

export const updateSchema = Joi.object({
  name: Joi.string().min(3).max(30),
  mobile: Joi.string().min(10),
  country_code: Joi.string(),
});