import React, { useState, useEffect } from 'react'
import { Button } from 'antd'
import './PikachuGuide.css'

interface GuideStep {
  id: number
  message: string
  options: string[]
  targetElement?: string
  action?: () => void
}

const guideSteps: GuideStep[] = [
  {
    id: 1,
    message: '皮卡！欢迎来到游戏工厂！我是你的助手皮卡丘～ 让我来教你如何使用这个平台吧！',
    options: ['开始学习', '稍后再说', '不再提示']
  },
  {
    id: 2,
    message: '首先，你需要创建一个游戏公司！点击左侧菜单的"公司管理"，然后点击"创建新公司"按钮。',
    options: ['明白了', '跳过教程', '上一步']
  },
  {
    id: 3,
    message: '接下来，你需要招募AI员工！前往"员工Agent"页面，创建不同类型的员工：策划、美术、程序员等。',
    options: ['继续', '跳过教程', '上一步']
  },
  {
    id: 4,
    message: '现在你可以开始制作游戏了！在"公司管理"页面，选择你的公司，然后提交游戏项目到生产线。',
    options: ['继续', '跳过教程', '上一步']
  },
  {
    id: 5,
    message: '皮卡～ 教程完成！你随时可以点击我来获取帮助。现在开始创造你的游戏帝国吧！',
    options: ['完成教程', '重新开始']
  }
]

interface PikachuGuideProps {
  isFirstLogin: boolean
}

const PikachuGuide: React.FC<PikachuGuideProps> = ({ isFirstLogin }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isMinimized, setIsMinimized] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasSeenGuide, setHasSeenGuide] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem('hasSeenGuide')
    if (!seen && isFirstLogin) {
      setHasSeenGuide(false)
      setTimeout(() => {
        setIsMinimized(false)
        setIsVisible(true)
      }, 1000)
    } else {
      setHasSeenGuide(true)
    }
  }, [isFirstLogin])

  const handleOptionClick = (option: string) => {
    if (option === '开始学习') {
      setCurrentStep(1)
    } else if (option === '稍后再说') {
      setIsVisible(false)
      setIsMinimized(true)
    } else if (option === '不再提示') {
      localStorage.setItem('hasSeenGuide', 'true')
      setHasSeenGuide(true)
      setIsVisible(false)
      setIsMinimized(true)
    } else if (option === '明白了' || option === '继续') {
      if (currentStep < guideSteps.length - 1) {
        setCurrentStep(currentStep + 1)
      }
    } else if (option === '上一步') {
      if (currentStep > 0) {
        setCurrentStep(currentStep - 1)
      }
    } else if (option === '跳过教程') {
      setCurrentStep(guideSteps.length - 1)
    } else if (option === '完成教程') {
      localStorage.setItem('hasSeenGuide', 'true')
      setHasSeenGuide(true)
      setIsVisible(false)
      setIsMinimized(true)
    } else if (option === '重新开始') {
      setCurrentStep(0)
    }
  }

  const handlePikachuClick = () => {
    if (isMinimized) {
      setIsMinimized(false)
      setIsVisible(true)
      if (hasSeenGuide) {
        setCurrentStep(0)
      }
    }
  }

  const handleHide = () => {
    setIsVisible(false)
    setIsMinimized(true)
  }

  return (
    <>
      {/* 背景遮罩 */}
      {isVisible && (
        <div className="pikachu-overlay" onClick={(e) => e.stopPropagation()} />
      )}

      {/* 皮卡丘角色 */}
      <div 
        className={`pikachu-character ${isMinimized ? 'minimized' : 'active'}`}
        onClick={handlePikachuClick}
      >
        <div className="pikachu-body">
          {/* 耳朵 */}
          <div className="pikachu-ear pikachu-ear-left"></div>
          <div className="pikachu-ear pikachu-ear-right"></div>
          
          {/* 脸 */}
          <div className="pikachu-face">
            {/* 眼睛 */}
            <div className="pikachu-eye pikachu-eye-left"></div>
            <div className="pikachu-eye pikachu-eye-right"></div>
            
            {/* 腮红 */}
            <div className="pikachu-cheek pikachu-cheek-left"></div>
            <div className="pikachu-cheek pikachu-cheek-right"></div>
            
            {/* 嘴巴 */}
            <div className="pikachu-mouth"></div>
          </div>
        </div>
        
        {/* 提示文字 */}
        {isMinimized && (
          <div className="pikachu-hint">点我获取帮助</div>
        )}
      </div>

      {/* 对话框 */}
      {isVisible && (
        <div className="pikachu-dialog">
          <div className="pikachu-dialog-content">
            <div className="pikachu-message">
              {guideSteps[currentStep].message}
            </div>
            <div className="pikachu-options">
              {guideSteps[currentStep].options.map((option, index) => (
                <Button
                  key={index}
                  type={index === 0 ? 'primary' : 'default'}
                  onClick={() => handleOptionClick(option)}
                  className="pikachu-option-btn"
                >
                  {option}
                </Button>
              ))}
            </div>
            <button className="pikachu-hide-btn" onClick={handleHide}>
              隐藏
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default PikachuGuide
