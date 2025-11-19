import React, { useState, useEffect } from 'react'
import { Button } from 'antd'
import './SailorMoonGuide.css'

interface GuideStep {
  id: number
  message: string
  options: string[]
  position?: { bottom: string; left: string }
  highlightSelector?: string  // 需要高亮显示（不被遮罩）的元素选择器
}

const guideSteps: GuideStep[] = [
  {
    id: 1,
    message: '我是月野兔！欢迎来到游戏工厂！让我来帮助你熟悉这里的功能吧！',
    options: ['开始学习', '稍后再说', '不再提示'],
    position: { bottom: '30px', left: '30px' }
  },
  {
    id: 2,
    message: '首先，让我们创建一个游戏公司！点击左边菜单的「公司管理」开始吧！',
    options: ['明白了', '跳过教程', '上一步'],
    position: { bottom: '50%', left: '150px' },
    highlightSelector: '[href="/companies"]'  // 高亮公司管理菜单项
  },
  {
    id: 3,
    message: '很好！现在你需要招募AI员工来帮你制作游戏，去「员工管理」看看吧！',
    options: ['继续', '跳过教程', '上一步'],
    position: { bottom: '40%', left: '150px' },
    highlightSelector: '[href="/agents"]'  // 高亮员工管理菜单项
  },
  {
    id: 4,
    message: '太棒了！现在你可以开始制作游戏了，前往「游戏制作」创建你的第一个游戏！',
    options: ['继续', '跳过教程', '上一步'],
    position: { bottom: '30%', left: '150px' },
    highlightSelector: '[href="/market"]'  // 高亮市场菜单项
  },
  {
    id: 5,
    message: '恭喜你完成了新手教程！现在你可以自由探索游戏工厂的所有功能了！代表月亮祝福你～',
    options: ['完成教程', '重新开始'],
    position: { bottom: '30px', left: '30px' }
  }
]

const SailorMoonGuide: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true)  // 始终初始显示
  const [isMinimized, setIsMinimized] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasSeenGuide, setHasSeenGuide] = useState(false)

  useEffect(() => {
    // 强制显示水冰月，忽略localStorage
    setIsVisible(true)
    console.log('水冰月组件已加载并显示')
  }, [])

  useEffect(() => {
    // 当步骤改变时，高亮对应的元素
    if (!isMinimized && currentStepData?.highlightSelector) {
      const element = document.querySelector(currentStepData.highlightSelector)
      if (element) {
        element.classList.add('guide-highlight')
      }
      
      // 清理之前的高亮
      return () => {
        const elements = document.querySelectorAll('.guide-highlight')
        elements.forEach(el => el.classList.remove('guide-highlight'))
      }
    }
  }, [currentStep, isMinimized])

  const handleOptionClick = (option: string) => {
    switch (option) {
      case '开始学习':
        setCurrentStep(1)
        break
      case '稍后再说':
        setIsVisible(false)
        break
      case '不再提示':
        localStorage.setItem('hasSeenGuide', 'true')
        setHasSeenGuide(true)
        setIsMinimized(true)  // 最小化而不是消失
        break
      case '明白了':
      case '继续':
        if (currentStep < guideSteps.length - 1) {
          setCurrentStep(currentStep + 1)
        }
        break
      case '上一步':
        if (currentStep > 0) {
          setCurrentStep(currentStep - 1)
        }
        break
      case '跳过教程':
        localStorage.setItem('hasSeenGuide', 'true')
        setHasSeenGuide(true)
        setIsMinimized(true)  // 最小化而不是消失
        break
      case '完成教程':
        localStorage.setItem('hasSeenGuide', 'true')
        setHasSeenGuide(true)
        setIsMinimized(true)  // 最小化而不是消失
        break
      case '重新开始':
        setCurrentStep(0)
        break
    }
  }

  const handleMinimize = () => {
    setIsMinimized(true)
  }

  const handleExpand = () => {
    setIsMinimized(false)
    setIsVisible(true)
  }

  const currentStepData = guideSteps[currentStep]

  return (
    <>
      {/* 遮罩层：只在教程对话框展开时显示，带有镂空效果 */}
      {isVisible && !isMinimized && (
        <div 
          className="sailormoon-overlay" 
          onClick={(e) => e.target === e.currentTarget && handleMinimize()}
          style={{
            background: currentStepData?.highlightSelector 
              ? 'transparent' 
              : 'rgba(0, 0, 0, 0.7)'
          }}
        >
          {currentStepData?.highlightSelector && (
            <div className="overlay-backdrop" onClick={(e) => e.target === e.currentTarget && handleMinimize()}></div>
          )}
        </div>
      )}
      
      {isVisible && (
        <div 
          className={`sailormoon-character ${isMinimized ? 'minimized' : ''}`}
          style={!isMinimized && currentStepData.position ? currentStepData.position : {}}
          onClick={isMinimized ? handleExpand : undefined}
          >
            {/* Sailor Moon Body */}
            <div className="sailormoon-body">
              {/* Hair with buns */}
              <div className="sailormoon-hair">
                <div className="hair-bun left"></div>
                <div className="hair-bun right"></div>
                <div className="hair-tail left"></div>
                <div className="hair-tail right"></div>
              </div>
              
              {/* Face */}
              <div className="sailormoon-face">
                <div className="sailormoon-eye left"></div>
                <div className="sailormoon-eye right"></div>
                <div className="sailormoon-mouth"></div>
                <div className="moon-mark"></div>
              </div>

              {/* Body */}
              <div className="sailormoon-body-main">
                <div className="sailor-collar"></div>
                <div className="bow red"></div>
              </div>
            </div>

            {/* Dialog */}
            {!isMinimized && (
              <div className="sailormoon-dialog">
                <button className="sailormoon-dialog-hide" onClick={handleMinimize}>✕</button>
                <div className="sailormoon-dialog-content">
                  <div className="sailormoon-message">{currentStepData.message}</div>
                  <div className="sailormoon-options">
                    {currentStepData.options.map((option, index) => (
                      <Button
                        key={index}
                        type="primary"
                        onClick={() => handleOptionClick(option)}
                        style={{
                          background: 'linear-gradient(135deg, #ff69b4 0%, #ff1493 100%)',
                          border: 'none',
                          boxShadow: '0 2px 8px rgba(255,105,180,0.4)'
                        }}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
      )}
    </>
  )
}

export default SailorMoonGuide
